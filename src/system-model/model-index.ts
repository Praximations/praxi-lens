import type { Component, Entity, Relationship, SemanticGroup, SystemModel } from "./schema.js";
import { validModel } from "./validate.js";
export { validModel };

/** Lookup structures shared by queries, views and explanations. Built once per validated model. */
export interface ModelIndex {
  readonly model: SystemModel;
  readonly entity: ReadonlyMap<string, Entity | Component>;
  readonly parent: ReadonlyMap<string, string>;
  /** Child IDs sorted by ID, so every projection is deterministic. */
  readonly children: ReadonlyMap<string, readonly string[]>;
  readonly relationship: ReadonlyMap<string, Relationship>;
  /** Adjacency sorted by relationship ID. */
  readonly outgoing: ReadonlyMap<string, readonly Relationship[]>;
  readonly incoming: ReadonlyMap<string, readonly Relationship[]>;
  /** Leaf components contained by each entity; a leaf counts itself. */
  readonly leaves: ReadonlyMap<string, number>;
  /** Relationship endpoints anywhere inside each entity, including itself. */
  readonly activity: ReadonlyMap<string, number>;
  readonly depth: ReadonlyMap<string, number>;
  readonly group: ReadonlyMap<string, SemanticGroup>;
}

const indexes = new WeakMap<SystemModel, ModelIndex>();

export function indexModel(input: SystemModel): ModelIndex {
  const model = validModel(input);
  const cached = indexes.get(model);
  if (cached) return cached;
  const entity = new Map<string, Entity | Component>([[model.system.id, model.system]]);
  const parent = new Map<string, string>();
  const children = new Map<string, string[]>();
  for (const component of model.components) {
    entity.set(component.id, component);
    parent.set(component.id, component.parentId);
    const siblings = children.get(component.parentId);
    if (siblings) siblings.push(component.id); else children.set(component.parentId, [component.id]);
  }
  for (const list of children.values()) list.sort();
  const sorted = [...model.relationships].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  const relationship = new Map(sorted.map(r => [r.id, r]));
  const outgoing = new Map<string, Relationship[]>();
  const incoming = new Map<string, Relationship[]>();
  const degree = new Map<string, number>();
  for (const r of sorted) {
    (outgoing.get(r.from) ?? outgoing.set(r.from, []).get(r.from)!).push(r);
    (incoming.get(r.to) ?? incoming.set(r.to, []).get(r.to)!).push(r);
    degree.set(r.from, (degree.get(r.from) ?? 0) + 1);
    degree.set(r.to, (degree.get(r.to) ?? 0) + 1);
  }
  const depth = new Map<string, number>([[model.system.id, 0]]);
  const order: string[] = [model.system.id];
  for (let i = 0; i < order.length; i++) {
    for (const child of children.get(order[i]!) ?? []) { depth.set(child, depth.get(order[i]!)! + 1); order.push(child); }
  }
  const leaves = new Map<string, number>();
  const activity = new Map<string, number>();
  // Reverse breadth-first order visits every child before its parent.
  for (let i = order.length - 1; i >= 0; i--) {
    const id = order[i]!;
    const kids = children.get(id);
    leaves.set(id, kids?.length ? kids.reduce((sum, k) => sum + leaves.get(k)!, 0) : 1);
    activity.set(id, (degree.get(id) ?? 0) + (kids ?? []).reduce((sum, k) => sum + activity.get(k)!, 0));
  }
  const index: ModelIndex = { model, entity, parent, children, relationship, outgoing, incoming, leaves, activity, depth,
    group: new Map(model.semanticGroups.map(g => [g.id, g])) };
  indexes.set(model, index);
  return index;
}

/** Ancestors from the entity's parent up to the system root. */
export function ancestorsOf(index: ModelIndex, id: string): string[] {
  const result: string[] = [];
  for (let cursor = index.parent.get(id); cursor !== undefined; cursor = index.parent.get(cursor)) result.push(cursor);
  return result;
}

/** Repository-style path for display, when an adapter recorded one. */
export function pathOf(entity: Entity | Component | undefined): string | undefined {
  const path = entity?.extensions["praxi.software"]?.data.path;
  return typeof path === "string" ? path : undefined;
}
