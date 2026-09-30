import { queryModel, type ViewQuery } from "../queries/query.js";
import type { SystemModel } from "../system-model/schema.js";
import { parseSystemModel } from "../system-model/validate.js";
import { viewSpecSchema, type ViewSpec } from "./spec.js";
import { overviewSelection } from "../queries/overview.js";
import type { EvidenceLevel } from "../system-model/schema.js";

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
  let edges: ViewSpec["edges"] = model.relationships.filter(r => result.relationshipIds.includes(r.id))
    .map(({ id, from, to, kind, provenance }) => ({ id, from, to, kind, provenance }));
  if (result.query.kind === "overview") {
    const q = result.query;
    const { representatives } = overviewSelection(model, q.rootId ?? model.system.id, q.depth, q.limit);
    const groups = new Map<string, typeof model.relationships>();
    for (const relationship of model.relationships.filter(r => result.relationshipIds.includes(r.id))) {
      const key = JSON.stringify([representatives.get(relationship.from), representatives.get(relationship.to), relationship.kind]);
      const group = groups.get(key) ?? []; group.push(relationship); groups.set(key, group);
    }
    edges = [...groups].sort(([a], [b]) => a.localeCompare(b)).map(([key, relationships]) => {
      const [from, to, kind] = JSON.parse(key) as [string, string, string];
      const claims = [...relationships.map(r => r.provenance), entities.get(from)!.provenance, entities.get(to)!.provenance];
      const levels: EvidenceLevel[] = ["INFERRED", "EXTERNAL", "USER_DEFINED", "DERIVED", "VERIFIED"];
      const weakest = levels.find(level => claims.some(p => p.level === level))!;
      return { id: `overview:${key}`, from, to, kind,
        relationshipIds: relationships.map(r => r.id).sort(),
        provenance: { level: weakest === "VERIFIED" ? "DERIVED" : weakest,
          evidenceIds: [...new Set(claims.flatMap(p => p.evidenceIds))].sort() } };
    });
  }
  const context = query.kind === "group" ? model.semanticGroups.find(g => g.id === query.groupId)
    : query.kind === "flow" ? model.flows.find(f => f.id === query.flowId) : undefined;
  const contextClaims = context ? [{ id: context.id, label: context.name, provenance: context.provenance }] : [];
  const type = query.kind === "hierarchy" ? "hierarchy" : query.kind === "flow" ? "flow"
    : query.kind === "neighbors" || query.kind === "path" ? "dependency" : "overview";
  const focusId = query.kind === "hierarchy" || query.kind === "overview" ? query.rootId ?? model.system.id
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
