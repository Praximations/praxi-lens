import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

export const root = fileURLToPath(new URL('../', import.meta.url));
function git(args) {
  try { return execFileSync('git', ['-c', `safe.directory=${root.replaceAll('\\', '/')}`, ...args],
    { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim(); }
  catch { return '(not available; repository may have no commit yet)'; }
}
async function digest() {
  const hash = createHash('sha256');
  async function add(relative) {
    for (const entry of (await readdir(path.join(root, relative), { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      const file = `${relative}/${entry.name}`;
      if (entry.isDirectory()) await add(file);
      else if (entry.isFile()) { hash.update(file); hash.update(await readFile(path.join(root, file))); }
    }
  }
  for (const directory of ['src', 'tests', 'examples', 'scripts']) await add(directory);
  for (const file of ['package.json', 'package-lock.json', 'tsconfig.json']) {
    hash.update(file); hash.update(await readFile(path.join(root, file)));
  }
  return hash.digest('hex');
}
export async function checkpoint(results = []) {
  const status = git(['status', '--short']).split('\n').filter(line => !line.endsWith('CHECKPOINT.md')).join('\n');
  const report = `# Generated checkpoint\n\n` +
    `Updated: ${new Date().toISOString()}\n\n` +
    `Read HANDOFF.md for decisions, limitations, and the next task. This file records actual local state; it does not imply a deployment or push.\n\n` +
    `- Branch: ${git(['branch', '--show-current'])}\n` +
    `- HEAD at capture time: ${git(['rev-parse', 'HEAD'])}\n` +
    `- Source SHA-256: ${await digest()}\n` +
    `- Node: ${process.version}\n\n` +
    `## Validation from this checkpoint\n\n` +
    (results.length ? results.map(r => `- ${r.name}: ${r.passed ? 'PASS' : 'FAIL'}`).join('\n') : '- Not rerun. Use npm run check to capture build and test results.') +
    `\n\nThe digest covers src, tests, examples, scripts, package manifests, and tsconfig. A checkpoint does not prove later edits were tested.\n\n` +
    `## Worktree at capture time\n\n\`\`\`text\n${status || '(clean except this generated checkpoint)'}\n\`\`\`\n`;
  await writeFile(path.join(root, 'CHECKPOINT.md'), report);
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  await checkpoint(); console.log('Updated CHECKPOINT.md. Update HANDOFF.md with decisions and next steps.');
}
