import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeRepositorySnapshot } from '../dist/adapters/repository/index.js';
import { interpretSoftwareRoles, classifySoftwareComponent, indexModel, generateView, viewSpecSchema, describeSystem,
  describeEntity, planTour, parseSystemModel, queryModel } from '../dist/index.js';
import { softwareModel } from '../examples/models.mjs';

const file = (path, content) => ({ path, content });
const { model: observed } = analyzeRepositorySnapshot({
  id: 'owner/shop', name: 'owner/shop', revision: 'd'.repeat(40), sourceUrl: 'https://github.com/owner/shop', description: 'An online shop',
  files: [
    file('package.json', '{"dependencies":{"react":"19","pg":"8","@anthropic-ai/sdk":"1","stripe":"1"},"devDependencies":{"vitest":"3"}}'),
    file('app/layout.tsx', "import { Button } from './components/Button';\nimport { Cart } from './components/Cart';\nexport default function Layout() { return null; }"),
    file('app/components/Button.tsx', "import React from 'react';\nexport function Button() { return null; }"),
    file('app/components/Cart.tsx', "import React from 'react';\nimport { Button } from './Button';\nexport function Cart() { return null; }"),
    file('app/api/orders/route.ts', "import { save } from '../../../lib/db';\nimport { charge } from '../../../lib/payments';\nimport { suggest } from '../../../src/agents/advisor';\nexport async function POST() { save(); charge(); suggest(); }"),
    file('lib/db.ts', "import { Pool } from 'pg';\nexport function save() {}"),
    file('lib/payments.ts', "import Stripe from 'stripe';\nexport function charge() {}"),
    file('src/agents/advisor.ts', "import Anthropic from '@anthropic-ai/sdk';\nexport function suggest() {}"),
    file('tests/orders.test.ts', "import { save } from '../lib/db';\nimport { test } from 'vitest';"),
    { path: 'docs/guide.md' }, { path: 'public/logo.png' }, { path: 'scripts/release.sh' }, { path: 'LICENSE' }, { path: '.gitignore' },
  ],
});
const model = interpretSoftwareRoles(observed);
const index = indexModel(model);
const roleOf = id => model.semanticGroups.find(g => g.memberIds.includes(id))?.id;

test('role interpretation is an inferred overlay that assigns every leaf exactly once without changing facts', () => {
  assert.deepEqual(model.components, observed.components);
  assert.deepEqual(model.relationships, observed.relationships);
  assert.equal(model.revision, observed.revision);
  assert.ok(model.semanticGroups.every(g => g.kind === 'role' && g.provenance.level === 'INFERRED' && g.description && g.provenance.confidence > 0));
  const leaves = model.components.filter(c => !model.components.some(o => o.parentId === c.id));
  for (const leaf of leaves) assert.equal(model.semanticGroups.filter(g => g.memberIds.includes(leaf.id)).length, 1, leaf.id);
  assert.deepEqual(interpretSoftwareRoles(model).semanticGroups, model.semanticGroups, 'repeat interpretation replaces, never duplicates');
  assert.deepEqual(interpretSoftwareRoles(parseSystemModel(softwareModel)).semanticGroups, [], 'hand-authored models without paths are left alone');
});

test('roles follow names, folders, file types and libraries, and explain why', () => {
  const expected = {
    'file:app/components/Button.tsx': 'role:interface', 'file:app/layout.tsx': 'role:interface', 'file:app/api/orders/route.ts': 'role:server',
    'file:lib/db.ts': 'role:data', 'file:lib/payments.ts': 'role:integrations', 'file:src/agents/advisor.ts': 'role:ai',
    'file:tests/orders.test.ts': 'role:tests', 'file:docs/guide.md': 'role:docs', 'file:public/logo.png': 'role:assets',
    'file:scripts/release.sh': 'role:tooling', 'file:package.json': 'role:config', 'file:LICENSE': 'role:docs', 'package:react': 'role:packages',
  };
  for (const [id, role] of Object.entries(expected)) assert.equal(roleOf(id), role, id);
  const reasons = classifySoftwareComponent(index, 'file:lib/db.ts').reasons.join(' ');
  assert.match(reasons, /uses pg/);
});

test('the architecture view projects roles and keeps every supporting relationship', () => {
  const view = generateView(model, { kind: 'groups', groupKind: 'role' });
  assert.equal(view.type, 'architecture');
  assert.equal(viewSpecSchema.safeParse(view).success, true);
  const serverToData = view.edges.find(e => e.from === 'role:server' && e.to === 'role:data');
  assert.deepEqual(serverToData.relationshipIds, ['reference:app/api/orders/route.ts:imports:../../../lib/db']);
  assert.equal(serverToData.provenance.level, 'INFERRED', 'a role connection is never more certain than the role overlay');
  assert.ok(view.nodes.every(n => n.memberIds?.length && n.description && n.layer !== undefined));
  assert.ok(view.edges.every(e => e.kindCounts && e.from !== e.to));
  const result = queryModel(model, { kind: 'groups', groupKind: 'role' });
  assert.ok(result.relationshipIds.includes('reference:app/api/orders/route.ts:imports:../../../lib/db'));
  const overview = generateView(model, { kind: 'overview', rootId: 'dir:app', combineKinds: true });
  assert.equal(overview.nodes.find(n => n.id === 'dir:app/components')?.role.groupId, 'role:interface');
});

test('descriptions explain the system and each part in plain language, citing owners as owners', () => {
  const system = describeSystem(model);
  assert.match(system.headline, /^owner\/shop is a software project written mostly in TypeScript, with 14 files/);
  assert.ok(system.paragraphs.some(p => p === 'Its owners describe it as: “An online shop”'));
  assert.ok(system.paragraphs.some(p => /it is mostly .*user interface/.test(p)));
  assert.equal(system.entryPoints[0]?.id, 'file:app/layout.tsx');
  assert.ok(system.mostUsed.slice(0, 2).some(m => m.id === 'file:lib/db.ts' && m.count === 2));
  assert.equal(system.roles.find(r => r.groupId === 'role:interface').places[0].label, 'app/components');
  const folder = describeEntity(model, 'dir:app/components');
  assert.equal(folder.role.groupId, 'role:interface');
  assert.equal(folder.size.files, 2);
  assert.match(folder.sentences[0], /^app\/components is a folder with 2 files, mostly TypeScript\.$/);
  assert.deepEqual(folder.usedBy.map(u => u.label), ['app/layout.tsx']);
  const db = describeEntity(model, 'file:lib/db.ts');
  assert.deepEqual(db.provides, ['save']);
  assert.ok(db.usedBy.some(u => u.label === 'app'), 'outside users appear at the level where they differ');
  assert.ok(db.role.reasons.length && db.role.confidence > 0);
  assert.match(describeEntity(model, 'package:pg').sentences[0], /outside package from npm/);
  assert.throws(() => describeEntity(model, 'missing'), /unknown_entity/);
});

test('the guided tour starts with the whole system, walks each part, then says where to start', () => {
  const tour = planTour(model);
  assert.equal(tour.view.type, 'architecture');
  assert.equal(tour.scenes[0].id, 'scene:intro');
  assert.match(tour.scenes[0].caption, /owner\/shop is a software project/);
  const ui = tour.scenes.find(s => s.id === 'scene:role:interface');
  assert.equal(ui.provenance.level, 'INFERRED');
  assert.ok(ui.relationshipIds.every(id => tour.view.edges.some(e => e.id === id)));
  assert.equal(tour.scenes.at(-1).id, 'scene:start');
  assert.match(tour.scenes.at(-1).caption, /app\/layout\.tsx/);
  assert.ok(tour.scenes.every(s => s.focusIds.every(id => tour.view.nodes.some(n => n.id === id))));
  const short = planTour(model, { maxScenes: 3 });
  assert.equal(short.scenes.length, 3);
  assert.equal(short.truncated, true);
});

test('large models stay fast: 30,000 files map, zoom and describe within interactive time', () => {
  const files = [];
  for (let a = 0; a < 30; a++) for (let b = 0; b < 20; b++) for (let c = 0; c < 50; c++) {
    const path = `pkg${a}/mod${b}/file${c}.ts`;
    files.push({ path, content: c ? `import x from './file${c - 1}';\nimport y from '../../pkg${(a + 1) % 30}/mod${b}/file0';` : '' });
  }
  const started = performance.now();
  const big = analyzeRepositorySnapshot({ id: 'o/big', name: 'o/big', revision: 'e'.repeat(40), sourceUrl: 'https://github.com/o/big', files: files.slice(0, 3000)
    .concat(files.slice(3000).map(f => ({ path: f.path }))) });
  const interpreted = interpretSoftwareRoles(big.model);
  const view = generateView(interpreted, { kind: 'overview', target: 24, combineKinds: true, limit: 60 });
  const deeper = generateView(interpreted, { kind: 'overview', rootId: 'dir:pkg0', target: 24, combineKinds: true });
  describeSystem(interpreted);
  describeEntity(interpreted, 'dir:pkg1');
  generateView(interpreted, { kind: 'search', text: 'file49', limit: 40 });
  const elapsed = performance.now() - started;
  assert.equal(big.stats.files, 30000);
  assert.ok(view.nodes.length <= 24 && view.nodes.length >= 10, String(view.nodes.length));
  assert.ok(deeper.nodes.length <= 24);
  assert.ok(view.edges.length > 0);
  assert.ok(elapsed < 20000, `took ${Math.round(elapsed)}ms`);
});
