import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSystemModel, analyze, manifestAdapter, queryModel, generateView, viewSpecSchema,
  applyInterpretation, planExplanation, ExtensionRegistry, softwareExtension, aiModelsExtension,
  databasesExtension, agentsExtension, workflowsExtension } from '../dist/index.js';
import { softwareModel, aiModel, databaseModel, workflowModel, robotModel } from '../examples/models.mjs';

const clone = () => structuredClone(softwareModel);
const registry = () => [softwareExtension, aiModelsExtension, databasesExtension, agentsExtension, workflowsExtension]
  .reduce((registry, extension) => registry.register(extension), new ExtensionRegistry());

test('one model and adapter support software, AI, databases, workflows, agents, and future systems', async () => {
  for (const input of [softwareModel, aiModel, databaseModel, workflowModel, robotModel]) {
    const result = await analyze(manifestAdapter, JSON.stringify(input), registry());
    assert.equal(result.model.system.id, input.system.id);
    assert.deepEqual(result.model, parseSystemModel(JSON.parse(JSON.stringify(result.model))));
    assert.equal(result.model.visibility, 'private');
    assert.equal(result.diagnostics.length, input === robotModel ? 1 : 0);
  }
});

test('rejects duplicate identities across different entity collections', () => {
  const model = clone(); model.relationships[0].id = 'api';
  assert.throws(() => parseSystemModel(model), /duplicate_id/);
});

test('rejects missing graph references and containment cycles', () => {
  const badParent = clone(); badParent.components[0].parentId = 'missing';
  assert.throws(() => parseSystemModel(badParent), /unknown_entity/);
  const cycle = clone(); cycle.components[1].parentId = 'auth';
  assert.throws(() => parseSystemModel(cycle), /hierarchy_cycle/);
  const badEdge = clone(); badEdge.relationships[0].to = 'missing';
  assert.throws(() => parseSystemModel(badEdge), /unknown_entity/);
});

test('rejects unsupported certainty and evidence references', () => {
  const missing = clone(); missing.components[0].provenance.evidenceIds = ['missing'];
  assert.throws(() => parseSystemModel(missing), /unknown_evidence/);
  for (const level of ['VERIFIED', 'DERIVED']) {
    const model = clone(); model.components[0].provenance.level = level;
    assert.throws(() => parseSystemModel(model), /unsupported_/);
  }
});

test('requires contiguous declared flows', () => {
  const model = clone(); model.flows[0].relationshipIds = ['ui-api', 'auth-db'];
  assert.throws(() => parseSystemModel(model), /disconnected_flow/);
});

test('extension validation rejects bad known metadata and preserves unknown namespaces', async () => {
  const model = structuredClone(aiModel);
  model.system.extensions['praxi.ai-models'].data.parameterCount = -1;
  await assert.rejects(() => analyze(manifestAdapter, model, registry()));
  assert.throws(() => registry().register(softwareExtension), /duplicate_extension/);
  const future = await analyze(manifestAdapter, robotModel, registry());
  assert.deepEqual(future.model.system.extensions, robotModel.system.extensions);
});

test('semantic zoom changes the selected abstraction without changing IDs or facts', () => {
  const model = parseSystemModel(softwareModel);
  const overview = generateView(model, { kind: 'hierarchy' });
  assert.equal(overview.nodes.some(n => n.id === 'auth'), false);
  assert.equal(overview.nodes.find(n => n.id === 'api').hiddenChildCount, 1);
  const focus = generateView(model, { kind: 'hierarchy', rootId: 'api', depth: 1 });
  assert.deepEqual(focus.nodes.map(n => n.id), ['api', 'auth']);
  assert.equal(focus.nodes[1].parentId, 'api');
  assert.equal(focus.nodes[0].parentId, undefined);
  assert.equal(focus.nodes[1].provenance.level, 'USER_DEFINED');
  assert.deepEqual(model, parseSystemModel(softwareModel));
});

test('dependency traversal supports direction, cycles, kind filtering, and bounded output', () => {
  const raw = clone();
  raw.relationships.push({ id: 'loop', from: 'db', to: 'ui', kind: 'test-loop', provenance: raw.system.provenance });
  const model = parseSystemModel(raw);
  const result = queryModel(model, { kind: 'neighbors', componentId: 'db', direction: 'incoming', hops: 8, limit: 2 });
  assert.deepEqual(result.entityIds, ['db', 'auth']);
  assert.equal(result.truncated, true);
  const filtered = queryModel(model, { kind: 'neighbors', componentId: 'db', direction: 'both', relationshipKinds: ['reads'] });
  assert.deepEqual(filtered.entityIds, ['db', 'auth']);
  assert.throws(() => queryModel(model, { kind: 'hierarchy', limit: 501 }));
});

test('directed shortest paths do not fabricate reachability or observed behavior', () => {
  const model = parseSystemModel(softwareModel);
  const path = generateView(model, { kind: 'path', fromId: 'ui', toId: 'db' });
  assert.deepEqual(path.edges.map(r => r.id), ['ui-api', 'api-auth', 'auth-db']);
  assert.equal(path.type, 'dependency');
  assert.deepEqual(path.sequence, []);
  assert.deepEqual(queryModel(model, { kind: 'path', fromId: 'db', toId: 'ui' }).entityIds, []);
  assert.deepEqual(queryModel(model, { kind: 'path', fromId: 'api', toId: 'api' }).entityIds, ['api']);
});

test('search filters existing models and fails explicitly on invalid focus', () => {
  const model = parseSystemModel(softwareModel);
  assert.deepEqual(queryModel(model, { kind: 'search', text: 'accounts', kinds: ['database'] }).entityIds, ['db']);
  assert.throws(() => generateView(model, { kind: 'hierarchy', rootId: 'missing' }), /unknown_entity/);
});

test('semantic interpretations are inferred overlays, versioned and evidence-linked', () => {
  const model = parseSystemModel(softwareModel);
  const proposal = { revision: 'interpreted-2', groups: [{ id: 'group:identity', name: 'Identity',
    memberIds: ['auth', 'db'], evidenceIds: ['evidence:example'], confidence: 0.7 }] };
  const interpreted = applyInterpretation(model, proposal);
  assert.equal(interpreted.semanticGroups[0].provenance.level, 'INFERRED');
  assert.deepEqual(interpreted.components, model.components);
  assert.equal(model.semanticGroups.length, 0);
  const view = generateView(interpreted, { kind: 'group', groupId: 'group:identity' });
  assert.equal(view.contextClaims[0].provenance.level, 'INFERRED');
  assert.deepEqual(view.nodes.map(n => n.id), ['auth', 'db']);
  assert.throws(() => applyInterpretation(model, { ...proposal, revision: model.revision }), /new_revision_required/);
  assert.throws(() => applyInterpretation(model, { ...proposal, groups: [{ ...proposal.groups[0], memberIds: ['missing'] }] }), /unknown_entity/);
});

test('generated views are serializable, bounded, and contain only evidenced model relationships', () => {
  const model = parseSystemModel(softwareModel);
  const view = generateView(model, { kind: 'hierarchy', depth: 4, limit: 3 });
  assert.deepEqual(viewSpecSchema.parse(JSON.parse(JSON.stringify(view))), view);
  assert.equal(view.truncated, true);
  for (const edge of view.edges) {
    assert.ok(view.nodes.some(n => n.id === edge.from)); assert.ok(view.nodes.some(n => n.id === edge.to));
    assert.ok(model.relationships.some(r => r.id === edge.id));
  }
  assert.ok(view.evidenceIds.every(id => model.evidence.some(e => e.id === id)));
});

test('explanation plans preserve evidence and reserve motion for explicit flows', () => {
  const model = parseSystemModel(softwareModel);
  const flow = planExplanation(model, { kind: 'flow', flowId: 'flow:login' }, { maxScenes: 2 });
  assert.equal(flow.truncated, true);
  assert.equal(flow.pacing, 'user-controlled');
  assert.deepEqual(flow.scenes.map(s => s.relationshipIds), [['ui-api'], ['api-auth']]);
  assert.ok(flow.scenes.every(s => s.motion === 'follow-flow' && s.provenance.level === 'USER_DEFINED'));
  const overview = planExplanation(model, { kind: 'hierarchy' }, { knownEntityIds: ['api'], detail: 'detailed' });
  assert.ok(overview.scenes.every(s => s.motion === 'none' && !s.focusIds.includes('api')));
  assert.ok(overview.scenes.every(s => s.caption.startsWith('user defined:')));
});

test('a flow scene does not hide an inferred relationship behind a stronger flow claim', () => {
  const model = clone();
  model.relationships[0].provenance = { level: 'INFERRED', evidenceIds: ['evidence:example'], confidence: 0.4 };
  const plan = planExplanation(parseSystemModel(model), { kind: 'flow', flowId: 'flow:login' });
  assert.equal(plan.scenes[0].provenance.level, 'INFERRED');
  assert.ok(plan.scenes[0].caption.startsWith('inferred:'));
});
