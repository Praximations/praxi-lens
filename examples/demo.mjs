import { mkdir, writeFile } from 'node:fs/promises';
import { analyze, manifestAdapter, ExtensionRegistry, softwareExtension, databasesExtension,
  generateView, planExplanation } from '../dist/index.js';
import { softwareModel } from './models.mjs';

const registry = new ExtensionRegistry().register(softwareExtension).register(databasesExtension);
const { model } = await analyze(manifestAdapter, softwareModel, registry);
const artifacts = {
  'system-model.json': model,
  'overview.json': generateView(model, { kind: 'hierarchy' }),
  'focus-api.json': generateView(model, { kind: 'hierarchy', rootId: 'api', depth: 1 }),
  'dependencies.json': generateView(model, { kind: 'neighbors', componentId: 'db', direction: 'incoming', hops: 3 }),
  'explanation.json': planExplanation(model, { kind: 'flow', flowId: 'flow:login' }),
};
await mkdir(new URL('../output/', import.meta.url), { recursive: true });
for (const [filename, value] of Object.entries(artifacts)) {
  await writeFile(new URL(`../output/${filename}`, import.meta.url), JSON.stringify(value, null, 2) + '\n');
}
console.log('Wrote five renderer-ready JSON examples to output/. No AI calls, network access, or UI rendering.');
