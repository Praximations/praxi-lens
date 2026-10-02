import { pathOf, type ModelIndex } from "../system-model/model-index.js";

/** One visible place in an overview: a real entity, or a bundle summarizing several. */
export interface OverviewSlot {
  id: string;
  /** Present when the slot shows a real model entity. */
  entityId?: string;
  label: string;
  /** Display-only location of the slot inside the focused root. */
  context?: string;
  /** Underlying entity IDs this slot stands for. */
  memberIds: string[];
  bundle?: "quiet" | "overflow";
}
export interface OverviewSelection {
  slots: OverviewSlot[];
  /** Visible slot that represents an entity, or undefined when it is outside the focus. */
  representative(entityId: string): string | undefined;
  truncated: boolean;
}
export interface OverviewOptions {
  rootId: string;
  /** Fixed number of levels to open. Ignored when target is set. */
  depth?: number;
  /** Open the most active places until about this many slots are visible. */
  target?: number;
  limit: number;
}

/**
 * Visible frontier of containment. Single-child folder chains read as one place, quiet leaves
 * and overflow are bundled rather than dropped, and projection never invents a relationship.
 */
export function selectOverview(index: ModelIndex, options: OverviewOptions): OverviewSelection {
  const { rootId, limit } = options;
  const kids = (id: string) => index.children.get(id) ?? [];
  const name = (id: string) => index.entity.get(id)?.name ?? id;
  const priority = (id: string) => index.activity.get(id)! * 4 + index.leaves.get(id)!;
  const byPriority = (a: OverviewSlot, b: OverviewSlot) =>
    priority(b.entityId!) - priority(a.entityId!) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  const chainOf = new Map<string, string>();
  const labels = new Map<string, string>([[rootId, ""]]);
  const pathLike = (id: string) => pathOf(index.entity.get(id)) !== undefined;
  let truncated = false;
  let bundles = 0;

  function compress(id: string): OverviewSlot {
    let current = id;
    const names = [name(id)];
    for (;;) {
      const next = kids(current);
      if (next.length !== 1 || !kids(next[0]!).length) break;
      chainOf.set(current, next[0]!);
      current = next[0]!;
      names.push(name(current));
    }
    return { id: current, entityId: current, label: names.join(pathLike(current) ? "/" : " › "), memberIds: [current] };
  }
  function bundle(members: OverviewSlot[], kind: "quiet" | "overflow", context: string | undefined, partial = true): OverviewSlot {
    const memberIds = members.flatMap(m => m.memberIds);
    const kinds = new Set(memberIds.map(id => index.entity.get(id)?.kind));
    const noun = kinds.size === 1 ? plural([...kinds][0] ?? "item", memberIds.length) : memberIds.length === 1 ? "item" : "items";
    if (kind === "overflow" && partial) truncated = true;
    return { id: `bundle:${++bundles}:${memberIds[0]}`, label: `${memberIds.length} ${kind === "quiet" ? "other" : "more"} ${noun}`,
      ...(context ? { context } : {}), memberIds, bundle: kind };
  }
  function slotsFor(parentId: string, cap: number, partial = true): OverviewSlot[] {
    const context = labels.get(parentId) || undefined;
    const entries = kids(parentId).map(compress);
    for (const entry of entries) {
      if (context) entry.context = context;
      labels.set(entry.id, context ? `${context}/${entry.label}` : entry.label);
    }
    const containers = entries.filter(e => kids(e.id).length);
    const leaves = entries.filter(e => !kids(e.id).length);
    const connected = leaves.filter(e => index.activity.get(e.id)! > 0);
    const quiet = leaves.filter(e => index.activity.get(e.id) === 0);
    let slots = [...containers, ...connected];
    // Unconnected leaves such as licenses and lockfiles summarize into one place beside real structure.
    if (quiet.length > 2 && slots.length) slots.push(bundle(quiet, "quiet", context));
    else slots.push(...quiet);
    if (slots.length > cap) {
      const ranked = slots.filter(s => !s.bundle).sort(byPriority);
      const keep = ranked.slice(0, Math.max(1, cap - 1));
      const rest = slots.filter(s => !keep.includes(s));
      slots = [...keep, bundle(rest, "overflow", context, partial)];
    }
    return slots;
  }
  const expandable = (slot: OverviewSlot) => !slot.bundle && kids(slot.id).length > 0;
  const cap = options.target ?? limit;
  let slots = slotsFor(rootId, cap);
  const openSingle = () => {
    while (slots.length === 1 && expandable(slots[0]!)) slots = slotsFor(slots[0]!.id, cap);
  };
  openSingle();
  if (options.target !== undefined) {
    const target = options.target;
    // With recorded connections, opening unconnected places (such as image folders) adds noise.
    const connected = index.relationship.size > 0;
    const worth = (slot: OverviewSlot) => expandable(slot) && (!connected || index.activity.get(slot.id)! > 0);
    for (let expanded = true; expanded;) {
      expanded = false;
      // Busiest places open first; when one cannot open whole, show its busiest parts plus one bundle.
      for (const candidate of slots.filter(worth).sort(byPriority)) {
        const room = target - (slots.length - 1);
        if (room < 2) break;
        const next = slotsFor(candidate.id, room, false);
        const whole = !next.some(slot => slot.bundle === "overflow");
        if (!whole && next.length - 1 < Math.min(3, kids(candidate.id).length)) continue;
        slots.splice(slots.indexOf(candidate), 1, ...next);
        expanded = true;
        break;
      }
    }
  } else {
    for (let level = 1; level < (options.depth ?? 1); level++) {
      slots = slots.flatMap(slot => expandable(slot) ? slotsFor(slot.id, cap) : [slot]);
      openSingle();
    }
  }
  if (slots.length > limit) {
    const ranked = slots.filter(s => !s.bundle).sort(byPriority);
    const keep = new Set(ranked.slice(0, Math.max(0, limit - 1)));
    slots = [...slots.filter(s => keep.has(s)), bundle(slots.filter(s => !keep.has(s)), "overflow", undefined)];
  }
  const visible = new Map<string, string>();
  for (const slot of slots) for (const member of slot.memberIds) visible.set(member, slot.id);
  // Chain intermediates such as "src" in "src/main/java" are represented by the compressed slot.
  for (const [from, to] of chainOf) {
    let end = to;
    while (chainOf.has(end)) end = chainOf.get(end)!;
    if (visible.has(end) && !visible.has(from)) visible.set(from, visible.get(end)!);
  }
  const memo = new Map<string, string | undefined>();
  function representative(entityId: string): string | undefined {
    if (memo.has(entityId)) return memo.get(entityId);
    let result: string | undefined;
    const direct = visible.get(entityId);
    if (direct) result = direct;
    else if (entityId !== rootId) {
      const parent = index.parent.get(entityId);
      result = parent === undefined ? undefined : representative(parent);
    }
    memo.set(entityId, result);
    return result;
  }
  return { slots, representative, truncated };
}

export function plural(kind: string, count: number): string {
  const noun = kind.replaceAll("-", " ").replace(/^directory$/, "folder").replace(/^package reference$/, "package");
  if (count === 1) return noun;
  return noun.endsWith("y") && !/[aeiou]y$/.test(noun) ? noun.slice(0, -1) + "ies" : noun.endsWith("s") ? noun + "es" : noun + "s";
}
