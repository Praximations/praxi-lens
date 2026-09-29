import { z } from "zod";
import { idSchema, type SystemModel } from "../system-model/schema.js";
import { parseSystemModel } from "../system-model/validate.js";

const limit = z.number().int().min(1).max(500).default(40);
export const viewQuerySchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("hierarchy"), rootId: idSchema.optional(), depth: z.number().int().min(0).max(20).default(1), limit }).strict(),
  z.object({ kind: z.literal("neighbors"), componentId: idSchema,
    direction: z.enum(["incoming", "outgoing", "both"]).default("outgoing"),
    hops: z.number().int().min(1).max(8).default(1), relationshipKinds: z.array(z.string()).optional(), limit }).strict(),
  z.object({ kind: z.literal("path"), fromId: idSchema, toId: idSchema,
    relationshipKinds: z.array(z.string()).optional(), limit }).strict(),
  z.object({ kind: z.literal("search"), text: z.string().min(1), kinds: z.array(z.string()).optional(), limit }).strict(),
  z.object({ kind: z.literal("group"), groupId: idSchema, limit }).strict(),
  z.object({ kind: z.literal("flow"), flowId: idSchema, limit }).strict(),
]);
export type ViewQuery = z.input<typeof viewQuerySchema>;
export interface QueryResult {
  query: z.output<typeof viewQuerySchema>;
  entityIds: string[];
  relationshipIds: string[];
  orderedRelationshipIds: string[];
  truncated: boolean;
}

/** Graph paths describe relationships. They are never promoted to runtime traces. */
export function queryModel(input: SystemModel, queryInput: ViewQuery): QueryResult {
  const model = parseSystemModel(input);
  const query = viewQuerySchema.parse(queryInput);
  const entities = [model.system, ...model.components];
  const ids = new Set(entities.map(e => e.id));
  const requireId = (id: string) => { if (!ids.has(id)) throw new Error(`unknown_entity:${id}`); };
  const allRelationships = [...model.relationships].sort((a, b) => a.id.localeCompare(b.id));
  const relationshipKinds = "relationshipKinds" in query ? query.relationshipKinds : undefined;
  const relationships = allRelationships.filter(r => !relationshipKinds || relationshipKinds.includes(r.kind));
  const selected = new Set<string>();
  let ordered: string[] = [];
  let restrictEdges: Set<string> | undefined;

  if (query.kind === "hierarchy") {
    const rootId = query.rootId ?? model.system.id;
    requireId(rootId); selected.add(rootId);
    let frontier = [rootId];
    for (let level = 0; level < query.depth && frontier.length; level++) {
      const parents = new Set(frontier);
      frontier = model.components.filter(c => parents.has(c.parentId)).map(c => c.id).sort();
      for (const id of frontier) selected.add(id);
    }
  } else if (query.kind === "neighbors") {
    requireId(query.componentId); selected.add(query.componentId);
    let frontier = new Set([query.componentId]);
    for (let hop = 0; hop < query.hops; hop++) {
      const next = new Set<string>();
      for (const relationship of relationships) {
        if (query.direction !== "incoming" && frontier.has(relationship.from) && !selected.has(relationship.to)) next.add(relationship.to);
        if (query.direction !== "outgoing" && frontier.has(relationship.to) && !selected.has(relationship.from)) next.add(relationship.from);
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
      for (const r of relationships.filter(r => r.from === queue[i])) {
        if (visited.has(r.to)) continue;
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
    const needle = query.text.toLowerCase();
    for (const entity of entities) if ((!query.kinds || query.kinds.includes(entity.kind)) &&
      `${entity.name} ${entity.kind} ${entity.id}`.toLowerCase().includes(needle)) selected.add(entity.id);
  } else if (query.kind === "group") {
    const group = model.semanticGroups.find(g => g.id === query.groupId);
    if (!group) throw new Error(`unknown_group:${query.groupId}`);
    for (const id of group.memberIds) selected.add(id);
  } else {
    const flow = model.flows.find(f => f.id === query.flowId);
    if (!flow) throw new Error(`unknown_flow:${query.flowId}`);
    ordered = flow.relationshipIds;
    restrictEdges = new Set(ordered);
    for (const id of ordered) {
      const relationship = relationships.find(r => r.id === id)!;
      selected.add(relationship.from); selected.add(relationship.to);
    }
  }
  const entityIds = [...selected].slice(0, query.limit);
  const included = new Set(entityIds);
  const relationshipIds = relationships.filter(r => included.has(r.from) && included.has(r.to) &&
    (!restrictEdges || restrictEdges.has(r.id))).map(r => r.id);
  return { query, entityIds, relationshipIds,
    orderedRelationshipIds: ordered.filter(id => relationshipIds.includes(id)),
    truncated: selected.size > entityIds.length };
}
