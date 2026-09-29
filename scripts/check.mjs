import { spawnSync } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import { checkpoint, root } from './checkpoint.mjs';

const tests = (await readdir(new URL('../tests/', import.meta.url))).filter(f => f.endsWith('.test.mjs')).sort().map(f => `tests/${f}`);
const results = [];
for (const [name, args] of [
  ['TypeScript build', ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.json']],
  ['Node test suite', ['--test', ...tests]],
]) {
  const result = spawnSync(process.execPath, args, { cwd: root, stdio: 'inherit' });
  const passed = !result.error && result.status === 0;
  results.push({ name, passed });
  if (!passed) { process.exitCode = 1; break; }
}
await checkpoint(results);
console.log('Recorded validation and source fingerprint in CHECKPOINT.md.');
