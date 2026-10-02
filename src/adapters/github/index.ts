import { z } from "zod";
import { analyzeRepositorySnapshot, safeRepositoryPath, sourceCandidate, README, REPOSITORY_LIMITS, type RepositoryAnalysis } from "../repository/index.js";
import { MANIFEST } from "../repository/manifests.js";

export function parseGitHubRepository(value: string): { owner: string; repo: string } {
  const input = value.trim();
  const url = new URL(input.includes("://") ? input : `https://github.com/${input}`);
  const parts = url.pathname.replace(/\/$/, "").split("/").filter(Boolean);
  if (url.protocol !== "https:" || url.hostname !== "github.com" || url.port || url.username || url.password || url.search || url.hash || parts.length !== 2)
    throw new Error("Enter a GitHub repository URL, such as https://github.com/owner/repository.");
  const [owner, repoName] = parts as [string, string];
  const repo = repoName.replace(/\.git$/, "");
  if (!/^[\w-]+$/.test(owner) || !/^[\w.-]+$/.test(repo) || repo === "." || repo === "..") throw new Error("Invalid GitHub repository name.");
  return { owner, repo };
}
/** Default budgets keep a browser responsive; callers may raise them up to REPOSITORY_LIMITS. */
export const GITHUB_DEFAULTS = { files: 50_000, sourceFiles: 900, sourceBytes: 9_000_000, readDeadlineMs: 45_000, timeoutMs: 120_000 } as const;
export interface GitHubOptions {
  token?: string; ref?: string; signal?: AbortSignal;
  fetch?: typeof globalThis.fetch;
  onProgress?: (message: string) => void;
  /** Source files and bytes to read. Structure is always mapped up to the file limit. */
  budget?: { files?: number; sourceFiles?: number; sourceBytes?: number; readDeadlineMs?: number };
}
const hash = z.string().regex(/^[a-f0-9]{40,64}$/);
const entrySchema = z.object({ path: z.string(), type: z.string(), mode: z.string(), sha: hash, size: z.number().optional() });
type Entry = z.infer<typeof entrySchema>;

async function boundedText(response: Response, limit: number): Promise<string> {
  if (!response.body) throw new Error("GitHub returned an empty response.");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const part = await reader.read(); if (part.done) break;
      size += part.value.byteLength;
      if (size > limit) { await reader.cancel(); throw new Error("GitHub response exceeded the analysis size limit."); }
      chunks.push(part.value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(bytes);
}

const LOW_VALUE = /(?:^|\/)(?:tests?|__tests__|specs?|e2e|fixtures?|testdata|__mocks__|mocks?|examples?|samples?|demos?|docs?|benchmarks?|third_party|generated|gen)(?:\/|$)|\.(?:test|spec|stories|min)\.[\w]+$|\.d\.ts$|_test\.go$|(?:^|\/)test_[^/]+\.py$|_pb2(?:_grpc)?\.py$|\.pb\.go$/i;
const ENTRY = /(?:^|\/)(?:index|main|app|server|cli|mod|lib|__init__|__main__|page|layout|route|router|routes|api)\.[\w]+$/;
/**
 * Chooses which source files to read so every area of a large repository is represented:
 * manifests first, then a round-robin across top-level areas, preferring entry points and
 * shallow files, with tests, fixtures and generated code last.
 */
export function selectSources(entries: { path: string; size: number }[], maxFiles: number, maxBytes: number): string[] {
  const chosen: string[] = [];
  let bytes = 0;
  const take = (entry: { path: string; size: number }) => {
    if (chosen.length >= maxFiles || bytes + entry.size > maxBytes) return false;
    chosen.push(entry.path); bytes += entry.size; return true;
  };
  const eligible = entries.filter(e => sourceCandidate(e.path) && e.size <= REPOSITORY_LIMITS.fileBytes);
  const depth = (path: string) => path.split("/").length;
  const manifests = eligible.filter(e => MANIFEST.test(e.path) && !LOW_VALUE.test(e.path))
    .sort((a, b) => depth(a.path) - depth(b.path) || (a.path < b.path ? -1 : 1));
  for (const manifest of manifests.slice(0, Math.ceil(maxFiles * 0.15))) take(manifest);
  const taken = new Set(chosen);
  const rest = eligible.filter(e => !taken.has(e.path) && !MANIFEST.test(e.path));
  for (const tier of [rest.filter(e => !LOW_VALUE.test(e.path)), rest.filter(e => LOW_VALUE.test(e.path))]) {
    const areas = new Map<string, typeof tier>();
    for (const entry of tier) {
      const parts = entry.path.split("/");
      const area = parts.length <= 2 ? parts[0]! : parts.slice(0, 2).join("/");
      (areas.get(area) ?? areas.set(area, []).get(area)!).push(entry);
    }
    const queues = [...areas.entries()].sort(([a], [b]) => a < b ? -1 : 1).map(([, list]) => list.sort((a, b) =>
      Number(ENTRY.test(b.path)) - Number(ENTRY.test(a.path)) || depth(a.path) - depth(b.path) || (a.path < b.path ? -1 : 1)));
    for (let round = 0, progressed = true; progressed && chosen.length < maxFiles; round++) {
      progressed = false;
      for (const queue of queues) if (queue[round]) { progressed = true; take(queue[round]!); }
    }
  }
  return chosen;
}

/** Browser-compatible. Credentials go only to api.github.com; no source is executed or uploaded. */
export async function analyzeGitHubRepository(value: string, options: GitHubOptions = {}): Promise<RepositoryAnalysis> {
  const { owner, repo } = parseGitHubRepository(value);
  const request = options.fetch ?? globalThis.fetch;
  const budget = {
    files: Math.min(REPOSITORY_LIMITS.files, options.budget?.files ?? GITHUB_DEFAULTS.files),
    sourceFiles: Math.min(REPOSITORY_LIMITS.sourceFiles, options.budget?.sourceFiles ?? GITHUB_DEFAULTS.sourceFiles),
    sourceBytes: Math.min(REPOSITORY_LIMITS.totalSourceBytes - 300_000, options.budget?.sourceBytes ?? GITHUB_DEFAULTS.sourceBytes),
    readDeadlineMs: options.budget?.readDeadlineMs ?? GITHUB_DEFAULTS.readDeadlineMs,
  };
  const base = `https://api.github.com/repos/${owner}/${repo}`;
  const started = Date.now();
  const timeout = AbortSignal.timeout(GITHUB_DEFAULTS.timeoutMs);
  const combined = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
  async function get(url: string, maxBytes: number, raw = false): Promise<string> {
    const headers: Record<string, string> = raw ? {} : { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };
    if (options.token && new URL(url).hostname === "api.github.com") headers.Authorization = `Bearer ${options.token}`;
    const response = await request(url, { headers, signal: combined, redirect: "error", credentials: "omit", referrerPolicy: "no-referrer" });
    if (!response.ok) {
      if (response.status === 403 || response.status === 429) throw new Error("GitHub rate limit or repository permission denied. Wait for the limit to reset, or use a read-only token with access to this repository.");
      if (response.status === 404) throw new Error("Repository or revision not found. For a private repository, provide a read-only GitHub token with access.");
      if (response.status === 401) throw new Error("GitHub rejected the token. Check its expiry and repository access.");
      throw new Error(`GitHub request failed (${response.status}).`);
    }
    return boundedText(response, maxBytes);
  }
  options.onProgress?.("Reading repository and pinning a revision…");
  const metadata = z.object({ default_branch: z.string(), private: z.boolean(), description: z.string().nullable().optional(),
    topics: z.array(z.string()).optional() }).parse(JSON.parse(await get(base, 200_000)));
  const ref = options.ref?.trim() || metadata.default_branch;
  if (ref.length > 200 || /[\x00-\x1f]/.test(ref)) throw new Error("Invalid branch or revision.");
  const commit = z.object({ sha: hash, commit: z.object({ tree: z.object({ sha: hash }) }) }).parse(JSON.parse(await get(`${base}/commits/${encodeURIComponent(ref)}`, 2_000_000)));
  options.onProgress?.("Reading the repository structure…");
  const treeSchema = z.object({ tree: z.array(entrySchema), truncated: z.boolean() });
  const tree = treeSchema.parse(JSON.parse(await get(`${base}/git/trees/${commit.commit.tree.sha}?recursive=1`, 12_000_000)));
  let entries: Entry[] = tree.tree;
  let treeComplete = !tree.truncated;
  const warnings: string[] = [];
  if (tree.truncated) {
    // Very large repositories: list each top-level folder separately so no area silently disappears.
    options.onProgress?.("Large repository: reading each top-level folder…");
    try {
      const root = treeSchema.parse(JSON.parse(await get(`${base}/git/trees/${commit.commit.tree.sha}`, 2_000_000)));
      const folders = root.tree.filter(e => e.type === "tree" && safeRepositoryPath(e.path));
      const merged: Entry[] = root.tree.filter(e => e.type === "blob");
      treeComplete = !root.truncated;
      for (const [i, folder] of folders.entries()) {
        if (i >= 40) { treeComplete = false; warnings.push(`Structure omitted for ${folders.length - 40} top-level folders in this very large repository.`); break; }
        options.onProgress?.(`Reading structure of ${folder.path} (${i + 1}/${Math.min(folders.length, 40)})…`);
        const sub = treeSchema.parse(JSON.parse(await get(`${base}/git/trees/${folder.sha}?recursive=1`, 12_000_000)));
        if (sub.truncated) treeComplete = false;
        merged.push(...sub.tree.map(e => ({ ...e, path: `${folder.path}/${e.path}` })));
      }
      entries = merged;
    } catch (cause) {
      if (combined.aborted) throw new Error("Analysis cancelled or timed out. Try a smaller repository.");
      warnings.push(`Kept the partial structure GitHub returned: ${cause instanceof Error ? cause.message : "folder listing failed"}`);
    }
  }
  const allFiles = entries.filter(e => e.type === "blob" && ["100644", "100755"].includes(e.mode) && safeRepositoryPath(e.path));
  allFiles.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  const files: { path: string; content?: string }[] = allFiles.slice(0, budget.files).map(e => ({ path: e.path }));
  const byPath = new Map(files.map(f => [f.path, f]));
  const entryOf = new Map(allFiles.map(e => [e.path, e]));
  const eligible = files.filter(f => sourceCandidate(f.path) && (entryOf.get(f.path)?.size ?? Infinity) <= REPOSITORY_LIMITS.fileBytes);
  const readme = files.find(f => README.test(f.path) && (entryOf.get(f.path)?.size ?? Infinity) <= 200_000);
  const selected = selectSources(eligible.map(f => ({ path: f.path, size: entryOf.get(f.path)!.size! })), budget.sourceFiles, budget.sourceBytes)
    .map(path => byPath.get(path)!);
  if (readme) selected.unshift(readme);
  let completed = 0, cursor = 0, stoppedEarly = 0;
  await Promise.all(Array.from({ length: Math.min(metadata.private ? 6 : 12, selected.length) }, async () => {
    while (cursor < selected.length) {
      const file = selected[cursor++]!;
      // A soft deadline keeps the map useful: unread files remain structure-only and are reported.
      if (Date.now() - started > budget.readDeadlineMs) { stoppedEarly++; continue; }
      const entry = entryOf.get(file.path)!;
      try {
        if (metadata.private) {
          const blob = z.object({ encoding: z.literal("base64"), content: z.string() }).parse(JSON.parse(await get(`${base}/git/blobs/${entry.sha}`, Math.ceil(REPOSITORY_LIMITS.fileBytes * 1.4) + 10_000)));
          file.content = new TextDecoder().decode(Uint8Array.from(atob(blob.content.replace(/\s/g, "")), c => c.charCodeAt(0)));
          if (new TextEncoder().encode(file.content).length > REPOSITORY_LIMITS.fileBytes) throw new Error("file_too_large");
        } else {
          file.content = await get(`https://raw.githubusercontent.com/${owner}/${repo}/${commit.sha}/${file.path.split("/").map(encodeURIComponent).join("/")}`, file === readme ? 200_000 : REPOSITORY_LIMITS.fileBytes, true);
        }
        if (file === readme) file.content = file.content.slice(0, 60_000);
      } catch {
        delete file.content;
        if (combined.aborted) throw new Error("Analysis cancelled or timed out. Try a smaller repository.");
        warnings.push(`Source could not be read: ${file.path}`);
      }
      options.onProgress?.(`Reading source ${++completed}/${selected.length}…`);
    }
  }));
  options.onProgress?.("Building the system model and dependency views…");
  const result = analyzeRepositorySnapshot({ id: `${owner.toLowerCase()}/${repo.toLowerCase()}`, name: `${owner}/${repo}`,
    revision: commit.sha, sourceUrl: `https://github.com/${owner}/${repo}`, files,
    ...(metadata.description ? { description: metadata.description.slice(0, 500) } : {}),
    ...(metadata.topics?.length ? { topics: metadata.topics.slice(0, 30).map(t => t.slice(0, 60)) } : {}) });
  const skipped = allFiles.length - files.length;
  const readCount = result.stats.sourceFiles;
  result.stats.eligibleSourceFiles = eligible.length;
  result.stats.treeComplete = treeComplete && skipped === 0;
  if (warnings.length > 12) warnings.splice(12, warnings.length - 12, `${warnings.length - 12} more files could not be read.`);
  result.diagnostics.unshift(...warnings);
  if (stoppedEarly) result.diagnostics.unshift(`Stopped reading after ${Math.round(budget.readDeadlineMs / 1000)} seconds to keep the map responsive; ${stoppedEarly} selected files were not read.`);
  if (!treeComplete || skipped > 0) result.diagnostics.unshift(`Partial repository structure: showing ${files.length.toLocaleString("en-US")} files${skipped > 0 ? `; ${skipped.toLocaleString("en-US")} omitted` : ""}.`);
  const percent = eligible.length ? Math.round(readCount / eligible.length * 100) : 100;
  result.diagnostics.unshift(`Source coverage: read ${readCount.toLocaleString("en-US")} of ${eligible.length.toLocaleString("en-US")} source and manifest files (${percent}%), sampled across every area. Other files have structure only. Budget: ${budget.sourceFiles.toLocaleString("en-US")} files, ${(budget.sourceBytes / 1_000_000).toFixed(1)} MB.`);
  return result;
}
