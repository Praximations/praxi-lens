import type { Provenance, SystemModel } from "../system-model/schema.js";
import { indexModel, pathOf, type ModelIndex } from "../system-model/model-index.js";
import { dominantGroup, groupResolver } from "../queries/groups.js";
import { classifySoftwareComponent, ROLE_BY_ID } from "../interpretation/software-roles.js";
import { CODE_LANGUAGES } from "../extensions/software/languages.js";
import { ecosystemLabel, kindLabel, listPhrase, lowerName, percent, plural, relationshipVerb, relies } from "./vocabulary.js";

export interface PlaceRef { id: string; label: string; count: number }
export interface RoleSummary {
  groupId: string; name: string; description?: string; layer?: number; supporting: boolean;
  files: number; share: number; places: PlaceRef[]; uses: PlaceRef[]; usedBy: PlaceRef[]; provenance: Provenance;
}
export interface SystemDescription {
  id: string; title: string; kindLabel: string;
  /** Owners' own description and README opening, quoted as their claims. */
  description?: string; summary?: string; topics: string[];
  headline: string;
  paragraphs: string[];
  counts: { files: number; folders: number; sourceFilesRead: number; linesRead: number; packages: number; connections: number; components: number };
  languages: { name: string; files: number; share: number }[];
  roles: RoleSummary[];
  entryPoints: { id: string; label: string; reason: string }[];
  mostUsed: PlaceRef[];
  provenance: Provenance;
}
export interface EntityDescription {
  id: string; title: string; kindLabel: string; path?: string;
  role?: { groupId: string; name: string; description?: string; share?: number; confidence?: number; reasons: string[] };
  size: { files: number; folders: number; lines: number };
  languages: { name: string; files: number }[];
  uses: PlaceRef[]; usedBy: PlaceRef[];
  provides: string[];
  sentences: string[];
  provenance: Provenance;
}

const data = (index: ModelIndex, id: string) => index.entity.get(id)?.extensions["praxi.software"]?.data ?? {};
/** Readable location: a repository path when one exists, otherwise the entity's name. */
export function displayLabel(index: ModelIndex, id: string): string {
  const entity = index.entity.get(id);
  if (!entity) return id;
  return entity.kind === "package-reference" ? entity.name : pathOf(entity) ?? entity.name;
}
function top(map: Map<string, number>, n: number, label: (id: string) => string): PlaceRef[] {
  return [...map].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, n).map(([id, count]) => ({ id, label: label(id), count }));
}
function leavesUnder(index: ModelIndex, id: string): string[] {
  const out: string[] = [];
  const stack = [id];
  while (stack.length) {
    const next = stack.pop()!;
    const kids = index.children.get(next);
    if (kids?.length) stack.push(...kids); else out.push(next);
  }
  return out;
}
function languageCounts(index: ModelIndex, leaves: string[]) {
  const counts = new Map<string, number>();
  for (const id of leaves) {
    const language = data(index, id).language;
    if (typeof language === "string") counts.set(language, (counts.get(language) ?? 0) + 1);
  }
  return counts;
}
/** Readable place for an outside endpoint: the child of the lowest common ancestor that contains it. */
function placeFinder(index: ModelIndex, anchor: string) {
  const anchorLine = new Set([anchor]);
  for (let cursor = index.parent.get(anchor); cursor !== undefined; cursor = index.parent.get(cursor)) anchorLine.add(cursor);
  return (other: string) => {
    if (index.entity.get(other)?.kind === "package-reference") return other;
    let previous = other;
    for (let cursor: string | undefined = other; cursor !== undefined; previous = cursor, cursor = index.parent.get(cursor))
      if (anchorLine.has(cursor)) return previous;
    return other;
  };
}
function insideTest(index: ModelIndex, root: string) {
  const memo = new Map<string, boolean>([[root, true]]);
  const inside = (id: string): boolean => {
    const known = memo.get(id);
    if (known !== undefined) return known;
    const parent = index.parent.get(id);
    const result = parent === undefined ? false : inside(parent);
    memo.set(id, result);
    return result;
  };
  return inside;
}

export function describeEntity(input: SystemModel, id: string): EntityDescription {
  const index = indexModel(input);
  const entity = index.entity.get(id);
  if (!entity) throw new Error(`unknown_entity:${id}`);
  if (id === index.model.system.id) {
    const system = describeSystem(index.model);
    return { id, title: system.title, kindLabel: system.kindLabel, size: { files: system.counts.files, folders: system.counts.folders, lines: system.counts.linesRead },
      languages: system.languages.map(({ name, files }) => ({ name, files })), uses: [], usedBy: [], provides: [],
      sentences: [system.headline, ...system.paragraphs], provenance: entity.provenance };
  }
  const leaves = leavesUnder(index, id);
  const container = !!index.children.get(id)?.length;
  const inside = insideTest(index, id);
  const place = placeFinder(index, id);
  const uses = new Map<string, number>(), usedBy = new Map<string, number>();
  for (const r of index.relationship.values()) {
    const from = inside(r.from), to = inside(r.to);
    if (from && !to) { const p = place(r.to); uses.set(p, (uses.get(p) ?? 0) + 1); }
    else if (to && !from) { const p = place(r.from); usedBy.set(p, (usedBy.get(p) ?? 0) + 1); }
  }
  const label = (other: string) => displayLabel(index, other);
  const languages = [...languageCounts(index, leaves)].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([name, files]) => ({ name, files }));
  const lines = leaves.reduce((sum, leaf) => sum + (typeof data(index, leaf).lines === "number" ? data(index, leaf).lines as number : 0), 0);
  const folders = container ? [...index.children.keys()].filter(k => k !== id && inside(k) && index.entity.get(k)?.kind === "directory").length : 0;
  const roles = groupResolver(index, "role");
  let role: EntityDescription["role"];
  if (roles.groups.length) {
    const dominant = dominantGroup(index, [id], roles.resolve);
    const group = dominant && index.group.get(dominant.groupId);
    if (group && dominant) {
      const assignment = container ? undefined : classifySoftwareComponent(index, id);
      const matches = assignment && `role:${assignment.roleId}` === group.id;
      const mix = container ? [...dominant.counts].sort((a, b) => b[1] - a[1]).slice(0, 3)
        .map(([g, n]) => `${lowerName(index.group.get(g)!.name)} (${percent(n / dominant.total)})`) : [];
      role = { groupId: group.id, name: group.name, ...(group.description ? { description: group.description } : {}),
        ...(container ? { share: dominant.share } : {}), ...(matches ? { confidence: assignment!.confidence } : {}),
        reasons: matches ? assignment!.reasons : container ? [`its files are mostly ${listPhrase(mix)}`] : ["assigned by this model's interpretation"] };
    }
  }
  const files = leaves.filter(l => index.entity.get(l)?.kind === "file").length;
  const title = entity.kind === "directory" || entity.kind === "file" ? entity.name : entity.name;
  const path = pathOf(entity);
  const sentences: string[] = [];
  const mainLanguage = languages.find(l => CODE_LANGUAGES.has(l.name)) ?? languages[0];
  if (entity.kind === "directory") {
    sentences.push(`${path ?? title} is a folder with ${plural(files, "file")}${folders ? ` across ${plural(folders, "folder")}` : ""}${mainLanguage ? `, mostly ${mainLanguage.name}` : ""}.`);
  } else if (entity.kind === "file") {
    const language = data(index, id).language;
    sentences.push(`${title} is ${typeof language === "string" ? `a ${language} file` : "a file"}${lines ? ` with ${plural(lines, "line")}` : ""}${path && path.includes("/") ? ` in ${path.slice(0, path.lastIndexOf("/"))}` : ""}.`);
  } else if (entity.kind === "package-reference") {
    const ecosystem = data(index, id).ecosystem;
    sentences.push(`${title} is an outside package${typeof ecosystem === "string" ? ` from ${ecosystemLabel(ecosystem)}` : ""}. The project builds on it rather than containing it.`);
  } else {
    sentences.push(`${title} is ${/^[aeiou]/i.test(kindLabel(entity.kind)) ? "an" : "a"} ${kindLabel(entity.kind).toLowerCase()}${container ? ` containing ${plural(leaves.length, "part")}` : ""}.`);
  }
  if (role) {
    const lead = container ? (role.share ?? 0) >= 0.75 ? "Most of it looks like" : (role.share ?? 0) >= 0.5 ? "It is mainly" : "It is a mix, led by" : "It looks like part of the";
    sentences.push(`${lead} ${lowerName(role.name)}${role.description ? `: ${role.description.charAt(0).toLowerCase()}${role.description.slice(1)}` : "."}`);
  }
  const provides = Array.isArray(data(index, id).exports) ? (data(index, id).exports as string[]) : [];
  if (provides.length) sentences.push(`It provides ${listPhrase(provides.map(p => p === "default" ? "a default export" : p), 4)}.`);
  const usesTop = top(uses, 6, label), usedByTop = top(usedBy, 6, label);
  if (usesTop.length) sentences.push(`It relies on ${listPhrase(usesTop.map(u => u.label))}.`);
  if (usedByTop.length) sentences.push(`It is used by ${listPhrase(usedByTop.map(u => u.label))}.`);
  else if (entity.kind !== "package-reference" && files) sentences.push("No references to it were found in the files Lens read.");
  return { id, title, kindLabel: kindLabel(entity.kind), ...(path ? { path } : {}), ...(role ? { role } : {}),
    size: { files, folders, lines }, languages, uses: usesTop, usedBy: usedByTop, provides, sentences, provenance: entity.provenance };
}

const ENTRY = /^(?:index|main|app|server|cli|__main__|manage|wsgi|asgi|layout|page|lib|mod)\.[\w]+$/i;
export function describeSystem(input: SystemModel): SystemDescription {
  const index = indexModel(input);
  const { model } = index;
  const system = model.system;
  const meta = system.extensions["praxi.software"]?.data ?? {};
  const files = model.components.filter(c => c.kind === "file");
  const counts = {
    files: files.length, folders: model.components.filter(c => c.kind === "directory").length,
    sourceFilesRead: files.filter(f => typeof f.extensions["praxi.software"]?.data.lines === "number").length,
    linesRead: files.reduce((sum, f) => sum + (typeof f.extensions["praxi.software"]?.data.lines === "number" ? f.extensions["praxi.software"]!.data.lines as number : 0), 0),
    packages: model.components.filter(c => c.kind === "package-reference").length,
    connections: model.relationships.length, components: model.components.length,
  };
  const languageMap = languageCounts(index, files.map(f => f.id));
  const codeFiles = [...languageMap].filter(([name]) => CODE_LANGUAGES.has(name)).reduce((s, [, n]) => s + n, 0);
  const languages = [...languageMap].filter(([name]) => CODE_LANGUAGES.has(name)).sort((a, b) => b[1] - a[1]).slice(0, 6)
    .map(([name, n]) => ({ name, files: n, share: Math.round(n / Math.max(1, codeFiles) * 100) / 100 }));
  const { groups, resolve } = groupResolver(index, "role");
  const roleTotals = groups.reduce((sum, g) => sum + (g.id === "role:packages" ? 0 : g.memberIds.length), 0);
  const pairCounts = new Map<string, Map<string, number>>();
  for (const r of index.relationship.values()) for (const a of resolve(r.from)) for (const b of resolve(r.to)) {
    if (a === b) continue;
    const row = pairCounts.get(a) ?? pairCounts.set(a, new Map()).get(a)!;
    row.set(b, (row.get(b) ?? 0) + 1);
  }
  const groupName = (id: string) => index.group.get(id)?.name ?? id;
  const roles: RoleSummary[] = groups.map(group => {
    const places = new Map<string, number>();
    for (const member of group.memberIds) {
      if (index.entity.get(member)?.kind === "package-reference") continue;
      const chain = [member];
      for (let c = index.parent.get(member); c !== undefined && c !== system.id; c = index.parent.get(c)) chain.unshift(c);
      const place = chain.length > 2 ? chain[1]! : chain.length === 2 ? chain[0]! : system.id;
      places.set(place, (places.get(place) ?? 0) + 1);
    }
    const usedBy = new Map<string, number>();
    for (const [from, row] of pairCounts) if (row.has(group.id)) usedBy.set(from, row.get(group.id)!);
    const definition = ROLE_BY_ID.get(group.id.replace(/^role:/, ""));
    return { groupId: group.id, name: group.name, ...(group.description ? { description: group.description } : {}),
      ...(group.layer !== undefined ? { layer: group.layer } : {}), supporting: definition?.supporting ?? false,
      files: group.memberIds.length, share: group.id === "role:packages" ? 0 : Math.round(group.memberIds.length / Math.max(1, roleTotals) * 100) / 100,
      places: top(places, 3, id => id === system.id ? "the project root" : displayLabel(index, id)),
      uses: top(pairCounts.get(group.id) ?? new Map(), 4, groupName), usedBy: top(usedBy, 4, groupName), provenance: group.provenance };
  });
  const incoming = new Map<string, number>();
  for (const r of index.relationship.values()) {
    if (r.from === r.to || index.entity.get(r.from)?.kind !== "file" || index.entity.get(r.to)?.kind !== "file") continue;
    incoming.set(r.to, (incoming.get(r.to) ?? 0) + 1);
  }
  const mostUsed = top(incoming, 5, id => displayLabel(index, id));
  const entryPoints = files.filter(f => ENTRY.test(f.name) && CODE_LANGUAGES.has(String(f.extensions["praxi.software"]?.data.language ?? "")))
    .map(f => {
      const out = (index.outgoing.get(f.id) ?? []).filter(r => index.entity.get(r.to)?.kind === "file").length;
      const bonus = /^(?:main|index|app|server|cli|__main__|manage|wsgi|asgi)\./i.test(f.name) ? 6 : /^layout\./i.test(f.name) ? 5 : /^(?:lib|mod)\./i.test(f.name) ? 3 : 0;
      // Starting points sit near the top, bring many parts together and are rarely imported themselves.
      return { f, out, score: Math.min(out, 15) + bonus - (index.depth.get(f.id) ?? 0) * 8 - (incoming.get(f.id) ?? 0) * 3 - (/test|example|fixture|demo|preview/i.test(f.id) ? 50 : 0) };
    }).filter(e => e.out > 0).sort((a, b) => b.score - a.score || (a.f.id < b.f.id ? -1 : 1)).slice(0, 3)
    .map(({ f, out }) => ({ id: f.id, label: displayLabel(index, f.id), reason: `named like a starting point and brings together ${plural(out, "other file")}` }));

  const description = typeof meta.description === "string" ? meta.description : undefined;
  const summary = typeof meta.summary === "string" ? meta.summary : undefined;
  const main = languages[0];
  const isRepository = system.kind === "software-repository";
  const readLines = counts.linesRead >= 1000 ? `about ${(Math.round(counts.linesRead / 1000) * 1000).toLocaleString("en-US")}` : counts.linesRead.toLocaleString("en-US");
  const headline = isRepository
    ? `${system.name} is a software project${main ? ` written mostly in ${main.name}` : ""}, with ${plural(counts.files, "file")}${counts.linesRead ? ` (Lens read ${readLines} lines of code)` : ""}.`
    : `${system.name} is ${/^[aeiou]/i.test(kindLabel(system.kind)) ? "an" : "a"} ${kindLabel(system.kind).toLowerCase()} with ${plural(counts.components, "part")} and ${plural(counts.connections, "recorded connection")}.`;
  const paragraphs: string[] = [];
  if (description) paragraphs.push(`Its owners describe it as: “${description}”`);
  if (summary && summary !== description) paragraphs.push(`Its README begins: “${summary}”`);
  const mainRoles = roles.filter(r => !r.supporting && r.groupId !== "role:packages" && r.share >= 0.03).sort((a, b) => b.share - a.share);
  if (mainRoles.length) paragraphs.push(`Judging by folder names, file types and the libraries it uses, it is mostly ${listPhrase(mainRoles.map(r => `${lowerName(r.name)} (${percent(r.share)})`), 4)}.`);
  const fits = mainRoles.slice(0, 3).map(r => ({ role: r, on: r.uses.filter(u => u.id !== "role:packages" && !roles.find(x => x.groupId === u.id)?.supporting).slice(0, 2) }))
    .filter(f => f.on.length).map(f => `the ${lowerName(f.role.name)} ${relies(f.role.name)} on ${listPhrase(f.on.map(u => lowerName(u.label)))}`);
  if (fits.length) paragraphs.push(`How the parts fit: ${fits.join("; ")}.`);
  if (entryPoints.length) paragraphs.push(`Good places to start reading: ${listPhrase(entryPoints.map(e => e.label))}.`);
  if (mostUsed.length) paragraphs.push(`The most widely used ${mostUsed.length === 1 ? "file is" : "files are"} ${listPhrase(mostUsed.slice(0, 3).map(m => `${m.label} (used by ${plural(m.count, "file")})`))}.`);
  return { id: system.id, title: system.name, kindLabel: kindLabel(system.kind), ...(description ? { description } : {}), ...(summary ? { summary } : {}),
    topics: Array.isArray(meta.topics) ? meta.topics.filter((t): t is string => typeof t === "string") : [],
    headline, paragraphs, counts, languages, roles, entryPoints, mostUsed, provenance: system.provenance };
}

/** Sentence for one connection, e.g. "app/components uses shared (12 references)". */
export function describeConnection(input: SystemModel, from: string, to: string, kind: string, count = 1): string {
  const index = indexModel(input);
  const name = (id: string) => index.entity.has(id) ? displayLabel(index, id) : index.group.get(id)?.name ?? id;
  return `${name(from)} ${relationshipVerb(kind)} ${name(to)}${count > 1 ? ` (${plural(count, "reference")})` : ""}.`;
}
