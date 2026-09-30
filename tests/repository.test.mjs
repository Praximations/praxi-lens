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
