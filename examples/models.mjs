const declared = { level: 'USER_DEFINED', evidenceIds: ['evidence:example'] };
function example(id, name, kind, components, relationships = [], extensions = {}, flows = []) {
  return {
    schemaVersion: '0.1', revision: 'example-1', visibility: 'private',
    system: { id, name, kind, provenance: declared, extensions },
    components: components.map(c => ({ parentId: id, provenance: declared, ...c })),
    relationships: relationships.map(r => ({ provenance: declared, ...r })),
    flows: flows.map(f => ({ provenance: declared, ...f })),
    evidence: [{ id: 'evidence:example', level: 'USER_DEFINED',
      source: { adapter: 'praxi.manifest', uri: `example:${id}`, revision: 'example-1' },
      summary: 'Hand-authored fictional example; not analysis of a deployed system.' }],
    semanticGroups: [],
  };
}
export const softwareModel = example('system:sample-app', 'Sample application', 'software-system', [
  { id: 'ui', name: 'Web client', kind: 'application' },
  { id: 'api', name: 'API service', kind: 'service' },
  { id: 'auth', name: 'Authentication', kind: 'module', parentId: 'api',
    extensions: { 'praxi.software': { version: '0.1', data: { language: 'TypeScript', path: 'src/auth.ts' } } } },
  { id: 'db', name: 'Accounts database', kind: 'database',
    extensions: { 'praxi.databases': { version: '0.1', data: { engine: 'PostgreSQL' } } } },
], [
  { id: 'ui-api', from: 'ui', to: 'api', kind: 'requests' },
  { id: 'api-auth', from: 'api', to: 'auth', kind: 'uses' },
  { id: 'auth-db', from: 'auth', to: 'db', kind: 'reads' },
], {}, [{ id: 'flow:login', name: 'Declared login flow', relationshipIds: ['ui-api', 'api-auth', 'auth-db'] }]);

export const aiModel = example('system:sample-model', 'Sample model', 'ai-model', [
  { id: 'input', name: 'Token input', kind: 'interface' },
  { id: 'layer', name: 'Transformer layer', kind: 'layer', extensions: {
    'praxi.ai-models': { version: '0.1', data: { tensorShape: ['batch', 'tokens', 128] } },
  } },
], [{ id: 'input-layer', from: 'input', to: 'layer', kind: 'data-flow' }], {
  'praxi.ai-models': { version: '0.1', data: { architecture: 'illustrative-transformer', modalities: ['text'] } },
});

export const databaseModel = example('system:sample-db', 'Sample database', 'database-system', [
  { id: 'accounts', name: 'Accounts', kind: 'table', extensions: {
    'praxi.databases': { version: '0.1', data: { schema: 'public', table: 'accounts',
      columns: [{ name: 'id', type: 'uuid', nullable: false }] } },
  } },
]);

export const workflowModel = example('system:sample-workflow', 'Sample workflow', 'workflow', [
  { id: 'reviewer', name: 'Review agent', kind: 'agent', extensions: {
    'praxi.agents': { version: '0.1', data: { role: 'review', tools: ['read-document'], states: ['idle', 'reviewing'] } },
  } },
  { id: 'approval', name: 'Human approval', kind: 'step' },
], [{ id: 'review-approval', from: 'reviewer', to: 'approval', kind: 'hands-off' }], {
  'praxi.workflows': { version: '0.1', data: { trigger: 'document-submitted', retryLimit: 2 } },
});

// A future system type and namespace require no edits to Lens's core model.
export const robotModel = example('system:sample-robot', 'Sample robot', 'robot', [
  { id: 'sensor', name: 'Temperature sensor', kind: 'sensor' },
  { id: 'controller', name: 'Controller', kind: 'control-loop' },
], [{ id: 'sensor-controller', from: 'sensor', to: 'controller', kind: 'measurement' }], {
  'thirdparty.robot': { version: '1', data: { environment: 'laboratory' } },
});
