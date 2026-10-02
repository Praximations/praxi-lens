import { runQuery, viewQuerySchema, type ParsedViewQuery, type ViewQuery } from "../queries/query.js";
import type { EvidenceLevel, Provenance, Relationship, SystemModel } from "../system-model/schema.js";
import { indexModel, type ModelIndex } from "../system-model/model-index.js";
import { viewSpecSchema, type ViewSpec } from "./spec.js";
import { selectOverview } from "../queries/overview.js";
import { dominantGroup, groupLeafCount, groupResolver } from "../queries/groups.js";

type ViewNode = ViewSpec["nodes"][number];
type ViewEdge = ViewSpec["edges"][number];
const LEVELS: EvidenceLevel[] = ["INFERRED", "EXTERNAL", "USER_DEFINED", "DERIVED", "VERIFIED"];

/** A combined claim is never more certain than its weakest part; aggregation itself is derived. */
export function weakestProvenance(claims: Provenance[], aggregated = false): Provenance {
  const weakest = LEVELS.find(level => claims.some(p => p.level === level))!;
  const confidences = claims.map(p => p.confidence).filter((c): c is number => c !== undefined);
  return { level: aggregated && weakest === "VERIFIED" ? "DERIVED" : weakest,
    evidenceIds: [...new Set(claims.flatMap(p => p.evidenceIds))].sort(),
    ...(confidences.length ? { confidence: Math.min(...confidences) } : {}) };
}

export function generateView(input: SystemModel, queryInput: ViewQuery): ViewSpec {
  const index = indexModel(input);
  const query = viewQuerySchema.parse(queryInput);
  const roles = groupResolver(index, "role");
  const roleOf = (ids: readonly string[]): ViewNode["role"] => {
    if (!roles.groups.length) return undefined;
    const dominant = dominantGroup(index, ids, roles.resolve);
    return dominant ? { groupId: dominant.groupId, name: index.group.get(dominant.groupId)!.name, share: dominant.share } : undefined;
  };
  let view: Omit<ViewSpec, "schemaVersion" | "model" | "evidenceIds" | "interactions" | "query">;
  if (query.kind === "overview") view = overview(index, query, roleOf);
  else if (query.kind === "groups") view = architecture(index, query);
  else {
    const result = runQuery(index, query);
    const included = new Set(result.entityIds);
    const nodes: ViewNode[] = result.entityIds.map(id => {
      const entity = index.entity.get(id)!;
      const parentId = index.parent.get(id);
      const kids = index.children.get(id) ?? [];
      const role = roleOf([id]);
      return { id, label: entity.name, kind: entity.kind,
        ...(parentId && included.has(parentId) ? { parentId } : {}),
        hiddenChildCount: kids.filter(k => !included.has(k)).length,
        provenance: entity.provenance, size: index.leaves.get(id)!, ...(role ? { role } : {}) };
    });
    // Model order keeps authored sequences (such as a path or flow) readable.
    const kept = new Set(result.relationshipIds);
    const edges: ViewEdge[] = index.model.relationships.filter(r => kept.has(r.id))
      .map(({ id, from, to, kind, provenance }) => ({ id, from, to, kind, provenance }));
    const context = query.kind === "group" ? index.group.get(query.groupId)
      : query.kind === "flow" ? index.model.flows.find(f => f.id === query.flowId) : undefined;
    const type = query.kind === "hierarchy" ? "hierarchy" : query.kind === "flow" ? "flow"
      : query.kind === "neighbors" || query.kind === "path" ? "dependency" : "overview";
    view = { type, nodes, edges,
      focusId: query.kind === "hierarchy" ? query.rootId ?? index.model.system.id
        : query.kind === "neighbors" ? query.componentId : query.kind === "path" && nodes.length ? query.fromId : undefined,
      layout: type === "hierarchy" ? "nested" : type === "flow" ? "sequence" : "directed",
      sequence: type === "flow" ? result.orderedRelationshipIds : [],
      contextClaims: context ? [{ id: context.id, label: context.name, provenance: context.provenance }] : [],
      truncated: result.truncated };
  }
  return viewSpecSchema.parse({
    schemaVersion: "0.1", model: { id: index.model.system.id, revision: index.model.revision }, query, ...view,
    evidenceIds: [...new Set([...view.nodes, ...view.edges, ...view.contextClaims].flatMap(x => x.provenance.evidenceIds))].sort(),
    interactions: ["focus", "expand", "collapse", "inspect-evidence"],
  });
}

/** Groups underlying relationships by visible endpoints, preserving every supporting relationship ID. */
function project(relationships: Iterable<Relationship>, endpoints: (r: Relationship) => [string, string][],
  combine: boolean, claimsFor: (from: string, to: string) => Provenance[]): ViewEdge[] {
  const groups = new Map<string, Relationship[]>();
  for (const relationship of relationships) for (const [from, to] of endpoints(relationship)) {
    if (from === to) continue;
    const key = JSON.stringify([from, to, combine ? "*" : relationship.kind]);
    const group = groups.get(key);
    if (group) group.push(relationship); else groups.set(key, [relationship]);
  }
  return [...groups].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, members]) => {
    const [from, to] = JSON.parse(key) as [string, string, string];
    const kindCounts: Record<string, number> = {};
    for (const r of members) kindCounts[r.kind] = (kindCounts[r.kind] ?? 0) + 1;
    const kinds = Object.keys(kindCounts);
    return { id: `overview:${key}`, from, to, kind: kinds.length === 1 ? kinds[0]! : "references",
      relationshipIds: members.map(r => r.id).sort(),
      ...(combine ? { kindCounts } : {}),
      provenance: weakestProvenance([...members.map(r => r.provenance), ...claimsFor(from, to)], true) };
  });
}

function overview(index: ModelIndex, query: Extract<ParsedViewQuery, { kind: "overview" }>,
  roleOf: (ids: readonly string[]) => ViewNode["role"]) {
  const rootId = query.rootId ?? index.model.system.id;
  if (!index.entity.has(rootId)) throw new Error(`unknown_entity:${rootId}`);
  const selection = selectOverview(index, { rootId, depth: query.depth, target: query.target, limit: query.limit });
  const provenance = new Map<string, Provenance>();
  const nodes: ViewNode[] = selection.slots.map(slot => {
    const role = roleOf(slot.memberIds);
    const claim = slot.entityId ? index.entity.get(slot.entityId)!.provenance
      : weakestProvenance(slot.memberIds.map(id => index.entity.get(id)!.provenance));
    provenance.set(slot.id, claim);
    const kind = slot.entityId ? index.entity.get(slot.entityId)!.kind : "bundle";
    return { id: slot.id, label: slot.label, kind, ...(slot.context ? { context: slot.context } : {}),
      hiddenChildCount: slot.entityId ? (index.children.get(slot.entityId)?.length ?? 0) : slot.memberIds.length,
      provenance: claim, size: slot.memberIds.reduce((sum, id) => sum + index.leaves.get(id)!, 0),
      ...(slot.bundle ? { memberIds: slot.memberIds } : {}), ...(role ? { role } : {}) };
  });
  const edges = project(index.relationship.values(), r => {
    const from = selection.representative(r.from), to = selection.representative(r.to);
    return from && to ? [[from, to]] : [];
  }, query.combineKinds, (from, to) => [provenance.get(from)!, provenance.get(to)!]);
  return { type: "overview" as const, focusId: rootId, layout: "directed" as const, nodes, edges, sequence: [],
    contextClaims: [], truncated: selection.truncated };
}

function architecture(index: ModelIndex, query: Extract<ParsedViewQuery, { kind: "groups" }>) {
  const { groups, resolve } = groupResolver(index, query.groupKind);
  const shown = groups.slice(0, query.limit);
  const visible = new Set(shown.map(g => g.id));
  const nodes: ViewNode[] = shown.map(group => ({ id: group.id, label: group.name, kind: group.kind ?? "group",
    hiddenChildCount: group.memberIds.length, provenance: group.provenance, size: groupLeafCount(index, group),
    memberIds: group.memberIds, ...(group.description ? { description: group.description } : {}),
    ...(group.layer !== undefined ? { layer: group.layer } : {}) }));
  const edges = project(index.relationship.values(), r => {
    const from = resolve(r.from).filter(id => visible.has(id)), to = resolve(r.to).filter(id => visible.has(id));
    return from.flatMap(a => to.map(b => [a, b] as [string, string]));
  }, true, (from, to) => [index.group.get(from)!.provenance, index.group.get(to)!.provenance]);
  return { type: "architecture" as const, layout: "layered" as const, nodes, edges, sequence: [],
    contextClaims: [], truncated: groups.length > shown.length };
}
