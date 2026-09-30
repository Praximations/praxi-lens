import { parse } from "@babel/parser";
import { z } from "zod";
import { parseSystemModel } from "../../system-model/validate.js";
import type { Component, Relationship, SystemModel } from "../../system-model/schema.js";

export const REPOSITORY_LIMITS = { files: 1200, sourceFiles: 40, fileBytes: 100_000, totalSourceBytes: 1_500_000 } as const;
const excluded = new Set([".git", "node_modules", "vendor", "dist", "build", ".next", "coverage", ".vercel", ".venv", "__pycache__"]);
export function safeRepositoryPath(path: string): boolean {
  if (!path || path.length > 220 || path.startsWith("/") || /[\\\x00-\x1f]/.test(path)) return false;
  const parts = path.split("/");
  if (parts.some(p => !p || p === "." || p === ".." || excluded.has(p.toLowerCase()))) return false;
  return !parts.some(p => /^\.env(?:\.|$)|^\.npmrc$|^\.netrc$|^id_(?:rsa|ed25519)|credentials|secrets|\.(?:pem|key|p12|pfx)$/i.test(p));
}
export function sourceCandidate(path: string): boolean {
  return safeRepositoryPath(path) && (/(?:^|\/)package\.json$/.test(path) || /\.[cm]?[jt]sx?$/.test(path));
}
export const repositorySnapshotSchema = z.object({
  id: z.string().min(1).max(150), name: z.string().min(1), revision: z.string().min(1),
  sourceUrl: z.string().url(),
  files: z.array(z.object({ path: z.string(), content: z.string().max(REPOSITORY_LIMITS.fileBytes).optional() }).strict()).max(REPOSITORY_LIMITS.files),
}).strict();
export type RepositorySnapshot = z.infer<typeof repositorySnapshotSchema>;
export interface RepositoryAnalysis {
  model: SystemModel;
  diagnostics: string[];
  stats: { files: number; sourceFiles: number; importRelationships: number; unresolvedImports: number };
}
type AstNode = { type: string; [key: string]: unknown };
function isNode(value: unknown): value is AstNode { return !!value && typeof value === "object" && "type" in value && typeof value.type === "string"; }

/** Parses source as data. Does not execute files, resolve URLs or run package scripts. */
export function analyzeRepositorySnapshot(input: RepositorySnapshot): RepositoryAnalysis {
  const snapshot = repositorySnapshotSchema.parse(input);
  const sourceUrl = new URL(snapshot.sourceUrl);
  if (sourceUrl.protocol !== "https:" || sourceUrl.hostname !== "github.com" || sourceUrl.username || sourceUrl.password)
    throw new Error("invalid_source_url");
  const files = snapshot.files.filter(f => safeRepositoryPath(f.path)).sort((a, b) => a.path.localeCompare(b.path));
  const paths = new Set(files.map(f => f.path));
  if (paths.size !== files.length) throw new Error("duplicate_repository_path");
  const totalBytes = files.reduce((size, f) => size + new TextEncoder().encode(f.content ?? "").length, 0);
  if (totalBytes > REPOSITORY_LIMITS.totalSourceBytes) throw new Error("source_budget_exceeded");
  const systemId = `repo:${snapshot.id}`;
  const treeEvidence = "evidence:tree";
  const proof = (id: string) => ({ level: "VERIFIED" as const, evidenceIds: [id] });
  const evidence: SystemModel["evidence"] = [{ id: treeEvidence, level: "VERIFIED", source: {
    adapter: "praxi.repository", uri: snapshot.sourceUrl, revision: snapshot.revision,
  }, summary: "File paths observed in the pinned repository tree. File presence does not imply runtime use." }];
  const components = new Map<string, Component>();
  const relationships: Relationship[] = [];
  const diagnostics: string[] = [];
  const fileId = (path: string) => `file:${path}`;
  const parentId = (path: string) => path.includes("/") ? `dir:${path.slice(0, path.lastIndexOf("/"))}` : systemId;
  for (const file of files) {
    const parts = file.path.split("/");
    for (let i = 1; i < parts.length; i++) {
      const path = parts.slice(0, i).join("/");
      components.set(`dir:${path}`, { id: `dir:${path}`, name: parts[i - 1]!, kind: "directory", parentId: parentId(path),
        provenance: proof(treeEvidence), extensions: { "praxi.software": { version: "0.1", data: { path } } } });
    }
    components.set(fileId(file.path), { id: fileId(file.path), name: parts.at(-1)!, kind: "file", parentId: parentId(file.path),
      provenance: proof(treeEvidence), extensions: { "praxi.software": { version: "0.1", data: { path: file.path } } } });
  }
  let unresolvedImports = 0;
  let sourceFiles = 0;
  const seen = new Set<string>();
  function reference(file: string, specifier: string, kind: string, evidenceId: string) {
    if (!specifier || specifier.length > 200) return;
    let target: string;
    if (specifier.startsWith(".")) {
      const base = file.split("/").slice(0, -1);
      for (const segment of specifier.split("/")) {
        if (segment === "..") {
          if (!base.length) { unresolvedImports++; return; }
          base.pop();
        } else if (segment !== ".") base.push(segment);
      }
      const candidate = base.join("/");
      const stem = candidate.replace(/\.[cm]?jsx?$/, "");
      const options = [candidate, ...[candidate, stem].flatMap(p => [".ts", ".tsx", ".js", ".jsx", ".mjs", ".mts", "/index.ts", "/index.tsx", "/index.js"].map(ext => p + ext))];
      const matches = [...new Set(options.filter(p => paths.has(p)))];
      // Ambiguous module resolution remains unresolved rather than inventing an edge.
      const match = paths.has(candidate) ? candidate : matches.length === 1 ? matches[0] : undefined;
      if (!match) { unresolvedImports++; return; }
      target = fileId(match);
    } else if (/^(?:@[^/]+\/[^/]+|[a-zA-Z0-9][\w.-]*)(?:\/.*)?$/.test(specifier) || specifier.startsWith("node:")) {
      const name = specifier.startsWith("@") ? specifier.split("/").slice(0, 2).join("/") : specifier.split("/")[0]!;
      // Alias syntax is unresolved; scoped package imports are package references, not installed-version claims.
      if (name.startsWith("@/")) { unresolvedImports++; return; }
      target = `package:${name}`;
      if (!components.has("group:packages")) components.set("group:packages", {
        id: "group:packages", name: "Referenced packages", kind: "dependency-group", parentId: systemId,
        provenance: { level: "DERIVED", evidenceIds: [evidenceId] }, extensions: {},
      });
      if (!components.has(target)) components.set(target, { id: target, name, kind: "package-reference", parentId: "group:packages",
        provenance: proof(evidenceId), extensions: { "praxi.software": { version: "0.1", data: { packageName: name } } } });
    } else { unresolvedImports++; return; }
    const id = `reference:${file}:${kind}:${specifier}`;
    if (id.length > 512 || seen.has(id)) return;
    seen.add(id); relationships.push({ id, from: fileId(file), to: target, kind,
      provenance: { level: "DERIVED", evidenceIds: [evidenceId, treeEvidence] }, extensions: {} });
  }
  for (const file of files) {
    if (file.content === undefined || !sourceCandidate(file.path)) continue;
    if (++sourceFiles > REPOSITORY_LIMITS.sourceFiles) throw new Error("source_file_budget_exceeded");
    const evidenceId = `evidence:${file.path}`;
    const uri = `${snapshot.sourceUrl.replace(/\/$/, "")}/blob/${encodeURIComponent(snapshot.revision)}/${file.path.split("/").map(encodeURIComponent).join("/")}`;
    evidence.push({ id: evidenceId, level: "VERIFIED", source: { adapter: "praxi.repository", uri, revision: snapshot.revision },
      summary: "Syntax observed in this file. Dependencies describe declared references, not actual execution." });
    if (file.path.endsWith("package.json")) {
      try {
        const value: unknown = JSON.parse(file.content);
        const pkg = z.object({ dependencies: z.record(z.string()).optional(), devDependencies: z.record(z.string()).optional() }).passthrough().parse(value);
        for (const name of Object.keys(pkg.dependencies ?? {})) reference(file.path, name, "declares-dependency", evidenceId);
        for (const name of Object.keys(pkg.devDependencies ?? {})) reference(file.path, name, "declares-dev-dependency", evidenceId);
      } catch { diagnostics.push(`Could not read package metadata: ${file.path}`); }
      continue;
    }
    try {
      const ast = parse(file.content, { sourceType: "unambiguous", plugins: ["typescript", "jsx"], createImportExpressions: true });
      const exports = new Set<string>();
      const walk = (node: AstNode) => {
        if (["ImportDeclaration", "ExportNamedDeclaration", "ExportAllDeclaration", "ImportExpression"].includes(node.type)) {
          const source = node.source;
          if (isNode(source) && source.type === "StringLiteral" && typeof source.value === "string")
            reference(file.path, source.value, node.type === "ImportExpression" ? "dynamic-import" : "imports", evidenceId);
        }
        if (node.type === "CallExpression" && isNode(node.callee) && node.callee.type === "Identifier" && node.callee.name === "require" && Array.isArray(node.arguments)) {
          const arg = node.arguments[0];
          if (isNode(arg) && arg.type === "StringLiteral" && typeof arg.value === "string") reference(file.path, arg.value, "require-reference", evidenceId);
        }
        if (node.type === "ExportDefaultDeclaration") exports.add("default");
        if (node.type === "ExportNamedDeclaration" && isNode(node.declaration) && isNode(node.declaration.id) && typeof node.declaration.id.name === "string") exports.add(node.declaration.id.name);
        for (const value of Object.values(node)) {
          if (isNode(value)) walk(value);
          else if (Array.isArray(value)) for (const child of value) if (isNode(child)) walk(child);
        }
      };
      walk(ast as unknown as AstNode);
      components.get(fileId(file.path))!.extensions["praxi.software"]!.data.exports = [...exports];
    } catch { diagnostics.push(`Source syntax was not analyzed: ${file.path}`); }
  }
  if (unresolvedImports) diagnostics.push(`${unresolvedImports} module references could not be resolved. Aliases and ambiguous paths are not guessed.`);
  const model = parseSystemModel({ schemaVersion: "0.1", revision: snapshot.revision, visibility: "private",
    system: { id: systemId, name: snapshot.name, kind: "software-repository", provider: "GitHub", provenance: proof(treeEvidence), extensions: {} },
    components: [...components.values()], relationships, flows: [], evidence, semanticGroups: [] });
  return { model, diagnostics, stats: { files: files.length, sourceFiles, importRelationships: relationships.length, unresolvedImports } };
}
