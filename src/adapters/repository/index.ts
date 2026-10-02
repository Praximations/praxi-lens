import { z } from "zod";
import { parseSystemModel } from "../../system-model/validate.js";
import type { Component, Relationship, SystemModel } from "../../system-model/schema.js";
import { ANALYZED_LANGUAGES, CODE_LANGUAGES, dirOf, extract, languageOf, type Context, type Target } from "./languages.js";
import { emptyManifests, MANIFEST, readManifest } from "./manifests.js";

export { languageOf, ANALYZED_LANGUAGES, CODE_LANGUAGES } from "./languages.js";
/** Hard ceilings for one snapshot. Callers such as the GitHub adapter choose smaller default budgets. */
export const REPOSITORY_LIMITS = { files: 60_000, sourceFiles: 3_000, fileBytes: 250_000, totalSourceBytes: 24_000_000 } as const;
const excluded = new Set([".git", "node_modules", "vendor", "dist", "build", ".next", "coverage", ".vercel", ".venv", "__pycache__"]);
const SECRET_LIKE = /^\.env(?:\.|$)|^\.npmrc$|^\.netrc$|^id_(?:rsa|ed25519)|credentials|secrets|\.(?:pem|key|p12|pfx)$/i;
/** Never read: names that suggest credentials. This is a precaution, not a secret scanner. */
export function secretLikePath(path: string): boolean { return path.split("/").some(p => SECRET_LIKE.test(p)); }
/**
 * Paths allowed in the structure map. Secret-like data files are excluded entirely; code files with
 * secret-like names (such as credentials.ts) stay visible as structure but their text is never read.
 */
export function safeRepositoryPath(path: string): boolean {
  if (!path || path.length > 220 || path.startsWith("/") || /[\\\x00-\x1f]/.test(path)) return false;
  const parts = path.split("/");
  if (parts.some(p => !p || p === "." || p === ".." || excluded.has(p.toLowerCase()))) return false;
  return !secretLikePath(path) || (CODE_LANGUAGES.has(languageOf(path) ?? "") && !/^\.|\.(?:pem|key|p12|pfx)$/i.test(parts.at(-1)!));
}
/** Files whose text Lens reads: manifests and source in languages with reference extractors. */
export function sourceCandidate(path: string): boolean {
  return safeRepositoryPath(path) && !secretLikePath(path) && (MANIFEST.test(path) || ANALYZED_LANGUAGES.has(languageOf(path) ?? ""));
}
export const README = /^readme(?:\.(?:md|markdown|rst|txt))?$/i;
export const repositorySnapshotSchema = z.object({
  id: z.string().min(1).max(150), name: z.string().min(1), revision: z.string().min(1),
  sourceUrl: z.string().url(),
  /** Owner-published repository metadata, such as a GitHub description. */
  description: z.string().max(500).optional(),
  topics: z.array(z.string().max(60)).max(30).optional(),
  files: z.array(z.object({ path: z.string(), content: z.string().max(REPOSITORY_LIMITS.fileBytes).optional() }).strict()).max(REPOSITORY_LIMITS.files),
}).strict();
export type RepositorySnapshot = z.infer<typeof repositorySnapshotSchema>;
export interface RepositoryStats {
  files: number; sourceFiles: number; importRelationships: number; unresolvedImports: number;
  standardLibraryImports: number; linesRead: number; languages: Record<string, number>;
  /** Set by ingestion adapters that sample: how many files could have been read, and whether the tree was complete. */
  eligibleSourceFiles?: number; treeComplete?: boolean;
}
export interface RepositoryAnalysis { model: SystemModel; diagnostics: string[]; stats: RepositoryStats }

/** First readable prose paragraph of a README: no code, markup, badges, lists or tables. */
export function readmeSummary(text: string): string | undefined {
  const prose = text.slice(0, 60_000).replace(/```[\s\S]*?```|~~~[\s\S]*?~~~/g, "\n\n").replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<[^>]+>/g, " ").replace(/^\.\. .*$/gm, "");
  for (const block of prose.split(/\r?\n\s*\r?\n/)) {
    const lines = block.split(/\r?\n/).filter(l => !/^\s*(?:#|=+\s*$|-{3,}\s*$|\||!\[|\[!\[|[-*+]\s|\d+\.\s|:\w+:)/.test(l));
    const sentence = lines.join(" ").replace(/!\[[^\]]*\]\([^)]*\)/g, "").replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/^\s*>\s*/, "").replace(/[*_`]+/g, "").replace(/\s+/g, " ").trim();
    if (sentence.length < 40 || sentence.split(" ").length < 6 || !/[a-z]{3}/.test(sentence)) continue;
    if (sentence.length <= 400) return sentence;
    const cut = sentence.slice(0, 400);
    const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
    return end > 120 ? cut.slice(0, end + 1) : cut.slice(0, cut.lastIndexOf(" ")) + "…";
  }
  return undefined;
}

/** Parses source as data. Does not execute files, resolve URLs, install packages or run scripts. */
export function analyzeRepositorySnapshot(input: RepositorySnapshot): RepositoryAnalysis {
  const snapshot = repositorySnapshotSchema.parse(input);
  const sourceUrl = new URL(snapshot.sourceUrl);
  if (sourceUrl.protocol !== "https:" || sourceUrl.hostname !== "github.com" || sourceUrl.username || sourceUrl.password)
    throw new Error("invalid_source_url");
  const files = snapshot.files.filter(f => safeRepositoryPath(f.path)).sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  const paths = new Set(files.map(f => f.path));
  if (paths.size !== files.length) throw new Error("duplicate_repository_path");
  const encoder = new TextEncoder();
  const totalBytes = files.reduce((size, f) => size + (f.content ? encoder.encode(f.content).length : 0), 0);
  if (totalBytes > REPOSITORY_LIMITS.totalSourceBytes) throw new Error("source_budget_exceeded");
  const systemId = `repo:${snapshot.id}`;
  const treeEvidence = "evidence:tree";
  const proof = (id: string) => ({ level: "VERIFIED" as const, evidenceIds: [id] });
  const evidence: SystemModel["evidence"] = [{ id: treeEvidence, level: "VERIFIED", source: {
    adapter: "praxi.repository", uri: snapshot.sourceUrl, revision: snapshot.revision,
  }, summary: "File paths observed in the pinned repository tree. File presence does not imply runtime use." }];
  const fileUri = (path: string) => `${snapshot.sourceUrl.replace(/\/$/, "")}/blob/${encodeURIComponent(snapshot.revision)}/${path.split("/").map(encodeURIComponent).join("/")}`;
  const components = new Map<string, Component>();
  const relationships: Relationship[] = [];
  const diagnostics: string[] = [];
  const languages: Record<string, number> = {};
  const dirs = new Set<string>();
  const byName = new Map<string, string[]>();
  const fileId = (path: string) => `file:${path}`;
  const parentId = (path: string) => path.includes("/") ? `dir:${dirOf(path)}` : systemId;
  for (const file of files) {
    const parts = file.path.split("/");
    for (let i = 1; i < parts.length; i++) {
      const path = parts.slice(0, i).join("/");
      if (dirs.has(path)) continue;
      dirs.add(path);
      components.set(`dir:${path}`, { id: `dir:${path}`, name: parts[i - 1]!, kind: "directory", parentId: parentId(path),
        provenance: proof(treeEvidence), extensions: { "praxi.software": { version: "0.1", data: { path } } } });
    }
    const language = languageOf(file.path);
    if (language) languages[language] = (languages[language] ?? 0) + 1;
    const name = parts.at(-1)!;
    (byName.get(name) ?? byName.set(name, []).get(name)!).push(file.path);
    components.set(fileId(file.path), { id: fileId(file.path), name, kind: "file", parentId: parentId(file.path),
      provenance: proof(treeEvidence), extensions: { "praxi.software": { version: "0.1", data: { path: file.path, ...(language ? { language } : {}) } } } });
  }
  const manifests = emptyManifests();
  for (const file of files) if (file.content !== undefined && MANIFEST.test(file.path)) readManifest(file.path, file.content, manifests);
  const pythonRoots = new Set(["", "src", "lib", ...manifests.pythonRoots]);
  for (const path of paths) if (/(?:^|\/)__init__\.py$/.test(path)) {
    const pkg = dirOf(path), outer = dirOf(pkg);
    if (pkg && !paths.has(outer ? `${outer}/__init__.py` : "__init__.py")) pythonRoots.add(outer);
  }
  const ctx: Context = { paths, dirs, byName, manifests, pythonRoots: [...pythonRoots].filter(r => r === "" || dirs.has(r)) };

  let unresolvedImports = 0, standardLibraryImports = 0, sourceFiles = 0, linesRead = 0;
  const seen = new Set<string>();
  function link(file: string, kind: string, specifier: string, target: Target, evidenceId: string) {
    if (target.type === "unresolved") { unresolvedImports++; return; }
    if (target.type === "standard") { standardLibraryImports++; return; }
    let to: string;
    if (target.type === "file") to = fileId(target.path);
    else if (target.type === "dir") to = target.path ? `dir:${target.path}` : systemId;
    else {
      to = target.ecosystem === "npm" ? `package:${target.name}` : `package:${target.ecosystem}:${target.name}`;
      if (!components.has("group:packages")) components.set("group:packages", {
        id: "group:packages", name: "Outside packages", kind: "dependency-group", parentId: systemId,
        provenance: { level: "DERIVED", evidenceIds: [evidenceId] }, extensions: {},
      });
      if (!components.has(to)) components.set(to, { id: to, name: target.name, kind: "package-reference", parentId: "group:packages",
        provenance: proof(evidenceId), extensions: { "praxi.software": { version: "0.1", data: { packageName: target.name, ecosystem: target.ecosystem } } } });
    }
    if (!components.has(to) && to !== systemId) { unresolvedImports++; return; }
    if (to === systemId || to === fileId(file)) return;
    const id = `reference:${file}:${kind}:${specifier}`;
    if (id.length > 512 || seen.has(id)) return;
    seen.add(id);
    relationships.push({ id, from: fileId(file), to, kind,
      provenance: { level: "DERIVED", evidenceIds: [evidenceId, treeEvidence] }, extensions: {} });
  }
  for (const file of files) {
    if (file.content === undefined || !sourceCandidate(file.path)) continue;
    if (++sourceFiles > REPOSITORY_LIMITS.sourceFiles) throw new Error("source_file_budget_exceeded");
    const evidenceId = `evidence:${file.path}`;
    evidence.push({ id: evidenceId, level: "VERIFIED", source: { adapter: "praxi.repository", uri: fileUri(file.path), revision: snapshot.revision },
      summary: "Syntax observed in this file. Dependencies describe declared references, not actual execution." });
    const data = components.get(fileId(file.path))!.extensions["praxi.software"]!.data;
    if (MANIFEST.test(file.path)) {
      for (const dep of manifests.dependencies.get(file.path) ?? []) {
        const workspace = dep.ecosystem === "npm" ? manifests.npmPackages.get(dep.name) : undefined;
        // A sibling package in the same repository is internal structure, not an outside package.
        const target: Target = workspace && workspace.dir !== dirOf(file.path) ? { type: "dir", path: workspace.dir } : { type: "package", name: dep.name, ecosystem: dep.ecosystem };
        link(file.path, dep.dev ? "declares-dev-dependency" : "declares-dependency", dep.name, target, evidenceId);
      }
      continue;
    }
    const result = extract(file.path, file.content, ctx);
    linesRead += result.lines;
    data.lines = result.lines;
    if (result.failed) { diagnostics.push(`Source syntax was not analyzed: ${file.path}`); continue; }
    if (result.exports.length) data.exports = result.exports;
    for (const reference of result.references) link(file.path, reference.kind, reference.specifier, reference.target, evidenceId);
  }
  diagnostics.push(...manifests.diagnostics);
  if (unresolvedImports) diagnostics.push(`${unresolvedImports} module references could not be resolved to a file or package. Unknown aliases and generated paths are not guessed.`);
  const readme = files.find(f => README.test(f.path) && f.content !== undefined);
  const summary = readme ? readmeSummary(readme.content!) : undefined;
  const systemEvidence = [treeEvidence];
  if (readme && summary) {
    evidence.push({ id: "evidence:readme", level: "VERIFIED", source: { adapter: "praxi.repository", uri: fileUri(readme.path), revision: snapshot.revision },
      summary: "Opening paragraph of the README, written by the project's authors. It describes their intent, not verified behavior." });
    systemEvidence.push("evidence:readme");
  }
  if (snapshot.description || snapshot.topics?.length) {
    evidence.push({ id: "evidence:metadata", level: "VERIFIED", source: { adapter: "praxi.repository", uri: snapshot.sourceUrl, revision: snapshot.revision },
      summary: "Repository description and topics published by the owners. These are their own claims about the project." });
    systemEvidence.push("evidence:metadata");
  }
  const systemData = { ...(snapshot.description ? { description: snapshot.description } : {}),
    ...(snapshot.topics?.length ? { topics: snapshot.topics } : {}), ...(summary ? { summary } : {}) };
  const model = parseSystemModel({ schemaVersion: "0.1", revision: snapshot.revision, visibility: "private",
    system: { id: systemId, name: snapshot.name, kind: "software-repository", provider: "GitHub",
      provenance: { level: "VERIFIED", evidenceIds: systemEvidence },
      extensions: Object.keys(systemData).length ? { "praxi.software": { version: "0.1", data: systemData } } : {} },
    components: [...components.values()], relationships, flows: [], evidence, semanticGroups: [] });
  return { model, diagnostics, stats: { files: files.length, sourceFiles, importRelationships: relationships.length, unresolvedImports,
    standardLibraryImports, linesRead, languages } };
}
