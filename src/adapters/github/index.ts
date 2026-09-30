import { z } from "zod";
import { analyzeRepositorySnapshot, safeRepositoryPath, sourceCandidate, REPOSITORY_LIMITS, type RepositoryAnalysis } from "../repository/index.js";

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
export interface GitHubOptions {
  token?: string; ref?: string; signal?: AbortSignal;
  fetch?: typeof globalThis.fetch;
  onProgress?: (message: string) => void;
}
const hash = z.string().regex(/^[a-f0-9]{40,64}$/);
const entrySchema = z.object({ path: z.string(), type: z.string(), mode: z.string(), sha: hash, size: z.number().optional() });

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

/** Browser-compatible. Credentials go only to api.github.com; no source is executed or uploaded. */
export async function analyzeGitHubRepository(value: string, options: GitHubOptions = {}): Promise<RepositoryAnalysis> {
  const { owner, repo } = parseGitHubRepository(value);
  const request = options.fetch ?? globalThis.fetch;
  const base = `https://api.github.com/repos/${owner}/${repo}`;
  const combined = options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(90_000)]) : AbortSignal.timeout(90_000);
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
  const metadata = z.object({ default_branch: z.string(), private: z.boolean() }).parse(JSON.parse(await get(base, 100_000)));
  const ref = options.ref?.trim() || metadata.default_branch;
  if (ref.length > 200 || /[\x00-\x1f]/.test(ref)) throw new Error("Invalid branch or revision.");
  const commit = z.object({ sha: hash, commit: z.object({ tree: z.object({ sha: hash }) }) }).parse(JSON.parse(await get(`${base}/commits/${encodeURIComponent(ref)}`, 2_000_000)));
  options.onProgress?.("Reading the repository structure…");
  const tree = z.object({ tree: z.array(entrySchema), truncated: z.boolean() }).parse(JSON.parse(await get(`${base}/git/trees/${commit.commit.tree.sha}?recursive=1`, 8_000_000)));
  const allFiles = tree.tree.filter(e => e.type === "blob" && ["100644", "100755"].includes(e.mode) && safeRepositoryPath(e.path));
  allFiles.sort((a, b) => a.path.localeCompare(b.path));
  const files: { path: string; content?: string }[] = allFiles.slice(0, REPOSITORY_LIMITS.files).map(e => ({ path: e.path }));
  const entries = new Map(allFiles.map(e => [e.path, e]));
  const candidates = files.filter(f => sourceCandidate(f.path) && (entries.get(f.path)?.size ?? Infinity) <= REPOSITORY_LIMITS.fileBytes)
    .sort((a, b) => Number(b.path.endsWith("package.json")) - Number(a.path.endsWith("package.json")) || a.path.split("/").length - b.path.split("/").length || a.path.localeCompare(b.path));
  const selected: typeof files = []; let budget = 0;
  for (const file of candidates) {
    const size = entries.get(file.path)!.size!;
    if (selected.length >= REPOSITORY_LIMITS.sourceFiles || budget + size > REPOSITORY_LIMITS.totalSourceBytes) continue;
    budget += size; selected.push(file);
  }
  let completed = 0; let cursor = 0;
  const warnings: string[] = [];
  await Promise.all(Array.from({ length: Math.min(4, selected.length) }, async () => {
    while (cursor < selected.length) {
      const file = selected[cursor++]!;
      const entry = entries.get(file.path)!;
      try {
        if (metadata.private) {
          const blob = z.object({ encoding: z.literal("base64"), content: z.string() }).parse(JSON.parse(await get(`${base}/git/blobs/${entry.sha}`, 160_000)));
          file.content = new TextDecoder().decode(Uint8Array.from(atob(blob.content.replace(/\s/g, "")), c => c.charCodeAt(0)));
          if (new TextEncoder().encode(file.content).length > REPOSITORY_LIMITS.fileBytes) throw new Error("file_too_large");
        } else {
          file.content = await get(`https://raw.githubusercontent.com/${owner}/${repo}/${commit.sha}/${file.path.split("/").map(encodeURIComponent).join("/")}`, REPOSITORY_LIMITS.fileBytes, true);
        }
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
    revision: commit.sha, sourceUrl: `https://github.com/${owner}/${repo}`, files });
  const skipped = allFiles.length - files.length;
  result.diagnostics.unshift(...warnings);
  if (tree.truncated || skipped > 0) result.diagnostics.unshift(`Partial repository tree: showing ${files.length} files${skipped > 0 ? `; ${skipped} omitted` : ""}.`);
  result.diagnostics.unshift(`Source coverage: ${result.stats.sourceFiles}/${allFiles.filter(f => sourceCandidate(f.path)).length} eligible JS/TS/package files read. Other files have structure only. Limits: 1,200 files, 40 source files, 1.5 MB source.`);
  return result;
}
