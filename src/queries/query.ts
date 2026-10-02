import { z } from "zod";
import { idSchema, type SystemModel } from "../system-model/schema.js";
import { indexModel, pathOf, type ModelIndex } from "../system-model/model-index.js";
import { selectOverview } from "./overview.js";
import { groupResolver } from "./groups.js";

const limit = z.number().int().min(1).max(500).default(40);
export const viewQuerySchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("overview"), rootId: idSchema.optional(), depth: z.number().int().min(1).max(20).default(1),
    /** Semantic zoom: open the most active places until about this many are visible. Overrides depth. */
    target: z.number().int().min(2).max(200).optional(),
    /** Merge parallel connections of different kinds into one connection per pair. */
    combineKinds: z.boolean().default(false), limit }).strict(),
  z.object({ kind: z.literal("hierarchy"), rootId: idSchema.optional(), depth: z.number().int().min(0).max(20).default(1), limit }).strict(),
  z.object({ kind: z.literal("neighbors"), componentId: idSchema,
    direction: z.enum(["incoming", "outgoing", "both"]).default("outgoing"),
    hops: z.number().int().min(1).max(8).default(1), relationshipKinds: z.array(z.string()).optional(), limit }).strict(),
  z.object({ kind: z.literal("path"), fromId: idSchema, toId: idSchema,
    relationshipKinds: z.array(z.string()).optional(), limit }).strict(),
  z.object({ kind: z.literal("search"), text: z.string().min(1), kinds: z.array(z.string()).optional(), limit }).strict(),
  z.object({ kind: z.literal("group"), groupId: idSchema, limit }).strict(),
  /** Projects overlay groups (for example inferred roles) and the references between them. */
  z.object({ kind: z.literal("groups"), groupKind: z.string().min(1).optional(), limit }).strict(),
  z.object({ kind: z.literal("flow"), flowId: idSchema, limit }).strict(),
]);
export type ViewQuery = z.input<typeof viewQuerySchema>;
export type ParsedViewQuery = z.output<typeof viewQuerySchema>;
export interface QueryResult {
  query: ParsedViewQuery;
  entityIds: string[];
  relationshipIds: string[];
  orderedRelationshipIds: string[];
  truncated: boolean;
}

/** Graph paths describe relationships. They are never promoted to runtime traces. */
export function queryModel(input: SystemModel, queryInput: ViewQuery): QueryResult {
  return runQuery(indexModel(input), viewQuerySchema.parse(queryInput));
}

export function runQuery(index: ModelIndex, query: ParsedViewQuery): QueryResult {
  const { model } = index;
  const requireId = (id: string) => { if (!index.entity.has(id)) throw new Error(`unknown_entity:${id}`); };
  const relationshipKinds = "relationshipKinds" in query ? query.relationshipKinds : undefined;
  const allowed = (kind: string) => !relationshipKinds || relationshipKinds.includes(kind);
  if (query.kind === "overview") {
    const rootId = query.rootId ?? model.system.id;
    requireId(rootId);
    const selection = selectOverview(index, { rootId, depth: query.depth, target: query.target, limit: query.limit });
    return { query, entityIds: selection.slots.flatMap(s => s.memberIds),
      // These are underlying model IDs, before generateView projects the endpoints.
      relationshipIds: [...index.relationship.values()].filter(r => {
        const from = selection.representative(r.from), to = selection.representative(r.to);
        return from && to && from !== to;
      }).map(r => r.id), orderedRelationshipIds: [], truncated: selection.truncated };
  }
  if (query.kind === "groups") {
    const { groups, resolve } = groupResolver(index, query.groupKind);
    const shown = new Set(groups.slice(0, query.limit).map(g => g.id));
    const members = new Set(groups.filter(g => shown.has(g.id)).flatMap(g => g.memberIds));
    return { query, entityIds: [...members].sort(),
      relationshipIds: [...index.relationship.values()].filter(r => {
        const from = resolve(r.from).filter(id => shown.has(id)), to = resolve(r.to).filter(id => shown.has(id));
        return from.some(a => to.some(b => a !== b));
      }).map(r => r.id), orderedRelationshipIds: [], truncated: groups.length > shown.size };
  }
  const selected = new Set<string>();
  let ordered: string[] = [];
  let restrictEdges: Set<string> | undefined;

  if (query.kind === "hierarchy") {
    const rootId = query.rootId ?? model.system.id;
    requireId(rootId); selected.add(rootId);
    let frontier = [rootId];
    for (let level = 0; level < query.depth && frontier.length; level++) {
      frontier = frontier.flatMap(id => index.children.get(id) ?? []).sort();
      for (const id of frontier) selected.add(id);
    }
  } else if (query.kind === "neighbors") {
    requireId(query.componentId); selected.add(query.componentId);
    let frontier = new Set([query.componentId]);
    for (let hop = 0; hop < query.hops; hop++) {
      const next = new Set<string>();
      for (const id of frontier) {
        if (query.direction !== "incoming") for (const r of index.outgoing.get(id) ?? []) if (allowed(r.kind) && !selected.has(r.to)) next.add(r.to);
        if (query.direction !== "outgoing") for (const r of index.incoming.get(id) ?? []) if (allowed(r.kind) && !selected.has(r.from)) next.add(r.from);
      }
      for (const id of [...next].sort()) selected.add(id);
      frontier = next;
    }
  } else if (query.kind === "path") {
    requireId(query.fromId); requireId(query.toId);
    const queue = [query.fromId];
    const visited = new Set(queue);
    const previous = new Map<string, { entityId: string; relationshipId: string }>();
    for (let i = 0; i < queue.length && !visited.has(query.toId); i++) {
      for (const r of index.outgoing.get(queue[i]!) ?? []) {
        if (!allowed(r.kind) || visited.has(r.to)) continue;
        visited.add(r.to); previous.set(r.to, { entityId: r.from, relationshipId: r.id }); queue.push(r.to);
      }
    }
    if (visited.has(query.toId)) {
      const path = [query.toId];
      let current = query.toId;
      while (current !== query.fromId) {
        const step = previous.get(current)!;
        ordered.unshift(step.relationshipId); path.unshift(step.entityId); current = step.entityId;
      }
      for (const id of path) selected.add(id);
    }
    restrictEdges = new Set(ordered);
  } else if (query.kind === "search") {
    for (const id of rankSearch(index, query.text, query.kinds)) selected.add(id);
  } else if (query.kind === "group") {
    const group = index.group.get(query.groupId);
    if (!group) throw new Error(`unknown_group:${query.groupId}`);
    for (const id of group.memberIds) selected.add(id);
  } else {
    const flow = model.flows.find(f => f.id === query.flowId);
    if (!flow) throw new Error(`unknown_flow:${query.flowId}`);
    ordered = flow.relationshipIds;
    restrictEdges = new Set(ordered);
    for (const id of ordered) {
      const relationship = index.relationship.get(id)!;
      selected.add(relationship.from); selected.add(relationship.to);
    }
  }
  const entityIds = [...selected].slice(0, query.limit);
  const included = new Set(entityIds);
  const relationshipIds: string[] = [];
  for (const id of included) for (const r of index.outgoing.get(id) ?? []) {
    if (included.has(r.to) && allowed(r.kind) && (!restrictEdges || restrictEdges.has(r.id))) relationshipIds.push(r.id);
  }
  relationshipIds.sort();
  const kept = new Set(relationshipIds);
  return { query, entityIds, relationshipIds,
    orderedRelationshipIds: ordered.filter(id => kept.has(id)),
    truncated: selected.size > entityIds.length };
}

/** Name matches outrank path or kind matches; shallower, larger and more connected places come first. */
function rankSearch(index: ModelIndex, text: string, kinds?: string[]): string[] {
  const needle = text.toLowerCase();
  const scored: { id: string; score: number }[] = [];
  for (const entity of index.entity.values()) {
    if (kinds && !kinds.includes(entity.kind)) continue;
    const name = entity.name.toLowerCase();
    const path = (pathOf(entity) ?? "").toLowerCase();
    let score = name === needle ? 0 : name.startsWith(needle) ? 1 : name.includes(needle) ? 2
      : path.includes(needle) ? 3 : `${entity.kind} ${entity.id}`.toLowerCase().includes(needle) ? 4 : -1;
    if (score < 0) continue;
    score = score * 1000 + Math.min(50, index.depth.get(entity.id) ?? 0) * 10 - Math.min(9, Math.log2(1 + (index.activity.get(entity.id) ?? 0)));
    scored.push({ id: entity.id, score });
  }
  return scored.sort((a, b) => a.score - b.score || (a.id < b.id ? -1 : 1)).map(s => s.id);
}
