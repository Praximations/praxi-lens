import { queryModel, type ViewQuery } from "../queries/query.js";
import type { SystemModel } from "../system-model/schema.js";
import { parseSystemModel } from "../system-model/validate.js";
import { viewSpecSchema, type ViewSpec } from "./spec.js";

export function generateView(input: SystemModel, query: ViewQuery): ViewSpec {
  const model = parseSystemModel(input);
  const result = queryModel(model, query);
  const entities = new Map([model.system, ...model.components].map(e => [e.id, e]));
  const parents = new Map(model.components.map(c => [c.id, c.parentId]));
  const included = new Set(result.entityIds);
  const nodes = result.entityIds.map(id => {
    const entity = entities.get(id)!;
    const parentId = parents.get(id);
    return { id, label: entity.name, kind: entity.kind,
      ...(parentId && included.has(parentId) ? { parentId } : {}),
      hiddenChildCount: model.components.filter(c => c.parentId === id && !included.has(c.id)).length,
      provenance: entity.provenance };
  });
  const edges = model.relationships.filter(r => result.relationshipIds.includes(r.id))
    .map(({ id, from, to, kind, provenance }) => ({ id, from, to, kind, provenance }));
  const context = query.kind === "group" ? model.semanticGroups.find(g => g.id === query.groupId)
    : query.kind === "flow" ? model.flows.find(f => f.id === query.flowId) : undefined;
  const contextClaims = context ? [{ id: context.id, label: context.name, provenance: context.provenance }] : [];
  const type = query.kind === "hierarchy" ? "hierarchy" : query.kind === "flow" ? "flow"
    : query.kind === "neighbors" || query.kind === "path" ? "dependency" : "overview";
  const focusId = query.kind === "hierarchy" ? query.rootId ?? model.system.id
    : query.kind === "neighbors" ? query.componentId : query.kind === "path" && nodes.length ? query.fromId : undefined;
  return viewSpecSchema.parse({
    schemaVersion: "0.1", model: { id: model.system.id, revision: model.revision },
    type, query: result.query, focusId,
    layout: type === "hierarchy" ? "nested" : type === "flow" ? "sequence" : "directed",
    nodes, edges, sequence: type === "flow" ? result.orderedRelationshipIds : [], contextClaims,
    evidenceIds: [...new Set([...nodes, ...edges, ...contextClaims].flatMap(x => x.provenance.evidenceIds))].sort(),
    truncated: result.truncated, interactions: ["focus", "expand", "collapse", "inspect-evidence"],
  });
}
