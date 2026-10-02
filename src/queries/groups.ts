import type { ModelIndex } from "../system-model/model-index.js";
import type { SemanticGroup } from "../system-model/schema.js";

/**
 * Resolves each entity to the overlay groups of one kind that contain it or its nearest
 * grouped ancestor. Overlays never reparent components; this only reads membership.
 */
export function groupResolver(index: ModelIndex, kind?: string) {
  const groups = index.model.semanticGroups.filter(g => kind === undefined || g.kind === kind)
    .sort((a, b) => (a.layer ?? 99) - (b.layer ?? 99) || (a.id < b.id ? -1 : 1));
  const direct = new Map<string, string[]>();
  for (const group of groups) for (const member of group.memberIds) {
    const list = direct.get(member);
    if (list) list.push(group.id); else direct.set(member, [group.id]);
  }
  const memo = new Map<string, readonly string[]>();
  const none: readonly string[] = [];
  function resolve(id: string): readonly string[] {
    const cached = memo.get(id);
    if (cached) return cached;
    const own = direct.get(id);
    const parent = index.parent.get(id);
    const result = own ?? (parent === undefined ? none : resolve(parent));
    memo.set(id, result);
    return result;
  }
  return { groups, resolve };
}

/** Counts grouped leaves under the given roots and returns the dominant group, if any. */
export function dominantGroup(index: ModelIndex, rootIds: readonly string[], resolve: (id: string) => readonly string[]) {
  const counts = new Map<string, number>();
  let total = 0;
  const stack = [...rootIds];
  while (stack.length) {
    const id = stack.pop()!;
    const kids = index.children.get(id);
    if (kids?.length) { stack.push(...kids); continue; }
    total++;
    for (const group of resolve(id)) counts.set(group, (counts.get(group) ?? 0) + 1);
  }
  let best: string | undefined;
  for (const [group, count] of counts) if (best === undefined || count > counts.get(best)! || (count === counts.get(best)! && group < best)) best = group;
  return best === undefined || !total ? undefined : { groupId: best, share: Math.round(counts.get(best)! / total * 100) / 100, counts, total };
}

export function groupLeafCount(index: ModelIndex, group: SemanticGroup): number {
  return group.memberIds.reduce((sum, id) => sum + (index.leaves.get(id) ?? 0), 0);
}
