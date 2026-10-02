import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeRepositorySnapshot, safeRepositoryPath } from '../dist/adapters/repository/index.js';
import { analyzeGitHubRepository, parseGitHubRepository } from '../dist/adapters/github/index.js';

const snapshot = {
  id: 'owner/repo', name: 'owner/repo', revision: 'a'.repeat(40), sourceUrl: 'https://github.com/owner/repo',
  files: [
    { path: 'package.json', content: '{"dependencies":{"react":"19"},"devDependencies":{"typescript":"5"}}' },
    { path: 'src/main.ts', content: `import { read } from './read.js'; export { read };\n// import 'fake-comment'\nconst literal = "require('fake-string')";\nimport type { X } from 'package-x';\nexport async function start() { return import('./lazy'); }` },
    { path: 'src/read.ts', content: 'export function read() { return 1; }' },
    { path: 'src/lazy.ts', content: 'export default 1;' },
    { path: '.env', content: 'TOKEN=never-include' },
    { path: 'node_modules/internal/index.js', content: 'ignore()' },
  ],
};
test('AST extraction produces evidenced dependencies, package references and stable file identities', () => {
  const result = analyzeRepositorySnapshot(snapshot);
  assert.equal(result.stats.files, 4);
  assert.ok(result.model.relationships.some(r => r.from === 'file:src/main.ts' && r.to === 'file:src/read.ts'));
  assert.ok(result.model.relationships.some(r => r.kind === 'dynamic-import' && r.to === 'file:src/lazy.ts'));
  assert.ok(result.model.relationships.some(r => r.kind === 'declares-dependency' && r.to === 'package:react'));
  assert.equal(JSON.stringify(result).includes('fake-comment'), false);
  assert.equal(JSON.stringify(result).includes('fake-string'), false);
  assert.equal(JSON.stringify(result).includes('never-include'), false);
  assert.equal(result.model.flows.length, 0);
  assert.equal(result.model.components.find(c => c.id === 'package:react').parentId, 'group:packages');
  assert.equal(result.model.visibility, 'private');
  const next = analyzeRepositorySnapshot({ ...snapshot, revision: 'b'.repeat(40) });
  assert.deepEqual(next.model.components.map(c => c.id), result.model.components.map(c => c.id));
});
test('rejects unsafe paths and reports unresolved or unparsable source honestly', () => {
  for (const path of ['../file.ts', '/root/a.ts', 'src\\a.ts', '.git/config', 'secrets/api.json', '.env.local', 'cert.pem']) assert.equal(safeRepositoryPath(path), false);
  const result = analyzeRepositorySnapshot({ ...snapshot, files: [
    { path: 'main.ts', content: "import x from '@/missing'; import y from './missing';" },
    { path: 'broken.ts', content: 'import ((( broken syntax' },
  ] });
  assert.equal(result.stats.unresolvedImports, 2);
  assert.equal(result.model.relationships.length, 0);
  assert.ok(result.diagnostics.some(d => d.includes('broken.ts')));
});
test('URL parser accepts only explicit GitHub repositories, without credentials or alternate hosts', () => {
  assert.deepEqual(parseGitHubRepository('owner/repo.git'), { owner: 'owner', repo: 'repo' });
  for (const input of ['https://evil.test/owner/repo', 'https://github.com.evil.test/owner/repo', 'https://token@github.com/owner/repo', 'https://github.com/o/r/tree/main', 'https://github.com/o/r?token=secret']) assert.throws(() => parseGitHubRepository(input));
});
test('relative imports escaping the repository root do not become internal dependencies', () => {
  const result = analyzeRepositorySnapshot({ ...snapshot, files: [
    { path: 'main.ts', content: "import '../target';" }, { path: 'target.ts', content: '' },
  ] });
  assert.equal(result.model.relationships.length, 0);
  assert.equal(result.stats.unresolvedImports, 1);
});
function mockGitHub(isPrivate = false) {
  const requests = [];
  const sha = 'a'.repeat(40);
  const fetch = async (url, options) => {
    requests.push({ url, options });
    let data;
    if (url === 'https://api.github.com/repos/owner/repo') data = { default_branch: 'main', private: isPrivate };
    else if (url.endsWith('/commits/main')) data = { sha, commit: { tree: { sha } } };
    else if (url.includes('/git/trees/')) data = { truncated: false, tree: [
      { path: 'main.ts', type: 'blob', mode: '100644', sha, size: 20 },
      { path: 'link.ts', type: 'blob', mode: '120000', sha, size: 20 },
      { path: '.env', type: 'blob', mode: '100644', sha, size: 20 },
    ] };
    else if (url.includes('/git/blobs/')) data = { encoding: 'base64', content: Buffer.from('export default 1;').toString('base64') };
    else if (url.startsWith('https://raw.githubusercontent.com/')) return new Response('export default 1;');
    else throw new Error('Unexpected request');
    return Response.json(data);
  };
  return { fetch, requests, sha };
}
test('public repository reads pin source to a commit and never send tokens to raw file hosts', async () => {
  const mock = mockGitHub();
  const result = await analyzeGitHubRepository('owner/repo', { fetch: mock.fetch, token: 'test-token' });
  assert.equal(result.stats.files, 1);
  assert.equal(result.stats.sourceFiles, 1);
  assert.equal(result.model.revision, mock.sha);
  const raw = mock.requests.find(r => r.url.includes('raw.githubusercontent.com'));
  assert.ok(raw.url.includes(mock.sha));
  assert.equal(raw.options.headers.Authorization, undefined);
  assert.ok(mock.requests.every(r => r.options.redirect === 'error' && r.options.credentials === 'omit'));
  assert.equal(JSON.stringify(result).includes('test-token'), false);
});
test('private repository tokens stay on GitHub API; source and credentials are not included in the model', async () => {
  const mock = mockGitHub(true);
  const result = await analyzeGitHubRepository('owner/repo', { fetch: mock.fetch, token: 'test-token' });
  assert.ok(mock.requests.every(r => r.url.startsWith('https://api.github.com/') && r.options.headers.Authorization === 'Bearer test-token'));
  assert.equal(result.stats.sourceFiles, 1);
  assert.equal(JSON.stringify(result).includes('export default'), false);
  assert.equal(JSON.stringify(result).includes('test-token'), false);
});
test('GitHub rate limits are explicit failures, not fabricated empty models', async () => {
  await assert.rejects(() => analyzeGitHubRepository('owner/repo', { fetch: async () => new Response('', { status: 429 }) }), /rate limit/);
});

test('code files with credential-like names stay visible as structure but are never read', () => {
  const result = analyzeRepositorySnapshot({ ...snapshot, files: [
    { path: 'src/auth.ts', content: "import { load } from './credentials';" },
    { path: 'src/credentials.ts', content: 'export const SECRET = "never-read-this";' },
    { path: 'secrets/keys.json', content: '{"k":"never-include-json"}' },
  ] });
  assert.ok(result.model.relationships.some(r => r.from === 'file:src/auth.ts' && r.to === 'file:src/credentials.ts'));
  assert.equal(result.stats.sourceFiles, 1);
  const text = JSON.stringify(result);
  assert.equal(text.includes('never-read-this'), false);
  assert.equal(text.includes('keys.json'), false);
});

test('source sampling covers every area before reading deeper into large ones', async () => {
  const { selectSources } = await import('../dist/adapters/github/index.js');
  const entries = [
    ...Array.from({ length: 50 }, (_, i) => ({ path: `big/area/file${String(i).padStart(2, '0')}.ts`, size: 100 })),
    { path: 'small/index.ts', size: 100 }, { path: 'other/main.py', size: 100 },
    ...Array.from({ length: 5 }, (_, i) => ({ path: `tests/case${i}.test.ts`, size: 100 })),
    { path: 'package.json', size: 50 }, { path: 'big/huge.ts', size: 10_000_000 },
  ];
  const chosen = selectSources(entries, 8, 100_000);
  assert.equal(chosen.length, 8);
  assert.equal(chosen[0], 'package.json');
  for (const path of ['small/index.ts', 'other/main.py']) assert.ok(chosen.includes(path), path);
  assert.equal(chosen.some(p => p.startsWith('tests/')), false, 'tests wait until main code is covered');
  assert.equal(chosen.includes('big/huge.ts'), false);
});

function largeRepositoryMock({ truncated = true } = {}) {
  const sha = 'b'.repeat(40);
  const requests = [];
  const fetch = async (url) => {
    requests.push(url);
    if (url === 'https://api.github.com/repos/owner/repo') return Response.json({ default_branch: 'main', private: false, description: 'Large test repository', topics: ['demo'] });
    if (url.endsWith('/commits/main')) return Response.json({ sha, commit: { tree: { sha } } });
    if (url.endsWith(`/git/trees/${sha}?recursive=1`)) return Response.json({ truncated, tree: [{ path: 'a/one.ts', type: 'blob', mode: '100644', sha, size: 20 }] });
    if (url.endsWith(`/git/trees/${sha}`)) return Response.json({ truncated: false, tree: [
      { path: 'README.md', type: 'blob', mode: '100644', sha, size: 120 },
      { path: 'a', type: 'tree', mode: '040000', sha: 'a'.repeat(40) }, { path: 'b', type: 'tree', mode: '040000', sha: 'c'.repeat(40) }] });
    if (url.endsWith(`/git/trees/${'a'.repeat(40)}?recursive=1`)) return Response.json({ truncated: false, tree: [{ path: 'one.ts', type: 'blob', mode: '100644', sha, size: 30 }] });
    if (url.endsWith(`/git/trees/${'c'.repeat(40)}?recursive=1`)) return Response.json({ truncated: false, tree: [{ path: 'two.ts', type: 'blob', mode: '100644', sha, size: 30 }] });
    if (url.endsWith('/README.md')) return new Response('# Big\n\nThis repository is a deliberately large example used to test structure recovery.\n');
    if (url.endsWith('/a/one.ts')) return new Response("import '../b/two';");
    if (url.startsWith('https://raw.githubusercontent.com/')) return new Response('export default 1;');
    throw new Error('Unexpected request ' + url);
  };
  return { fetch, requests };
}
test('truncated GitHub trees are completed folder by folder instead of silently dropping areas', async () => {
  const mock = largeRepositoryMock();
  const result = await analyzeGitHubRepository('owner/repo', { fetch: mock.fetch });
  assert.deepEqual(result.model.components.filter(c => c.kind === 'file').map(c => c.id).sort(), ['file:README.md', 'file:a/one.ts', 'file:b/two.ts']);
  assert.ok(result.model.relationships.some(r => r.from === 'file:a/one.ts' && r.to === 'file:b/two.ts'));
  assert.equal(result.stats.treeComplete, true);
  const data = result.model.system.extensions['praxi.software'].data;
  assert.equal(data.description, 'Large test repository');
  assert.match(data.summary, /deliberately large example/);
});
test('a reading deadline returns an honest partial map rather than failing', async () => {
  const mock = largeRepositoryMock({ truncated: false });
  const result = await analyzeGitHubRepository('owner/repo', { fetch: mock.fetch, budget: { readDeadlineMs: -1 } });
  assert.equal(result.stats.sourceFiles, 0);
  assert.ok(result.diagnostics.some(d => d.startsWith('Stopped reading')));
  assert.equal(mock.requests.some(u => u.startsWith('https://raw.githubusercontent.com/')), false);
});
