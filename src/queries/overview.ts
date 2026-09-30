import type { SystemModel } from "../system-model/schema.js";

/** Visible frontier of containment. Projection never invents a relationship. */
export function overviewSelection(model: SystemModel, rootId: string, depth: number, limit: number) {
  const children = new Map<string, string[]>();
  const parents = new Map(model.components.map(c => [c.id, c.parentId]));
  for (const component of model.components) {
    const siblings = children.get(component.parentId) ?? [];
    siblings.push(component.id); children.set(component.parentId, siblings);
  }
  const frontier: string[] = [];
  function visit(id: string, level: number) {
    const nested = children.get(id);
    if (level === depth || !nested?.length) frontier.push(id);
    else for (const child of [...nested].sort()) visit(child, level + 1);
  }
  visit(rootId, 0);
  const entityIds = frontier.slice(0, limit);
  const visible = new Set(entityIds);
  const representatives = new Map<string, string>();
  for (const entity of [model.system, ...model.components]) {
    let cursor: string | undefined = entity.id;
    while (cursor) {
      if (visible.has(cursor)) { representatives.set(entity.id, cursor); break; }
      if (cursor === rootId) break;
      cursor = parents.get(cursor);
    }
  }
  return { entityIds, representatives, truncated: frontier.length > entityIds.length };
}
