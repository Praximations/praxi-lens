/** Everyday words for model vocabulary. Display text only; IDs and kinds are unchanged. */
const KINDS: Record<string, string> = {
  directory: "Folder", file: "File", "package-reference": "Outside package", "dependency-group": "Outside packages",
  "software-repository": "Software project", "software-system": "Software system", bundle: "Group of items", role: "Role",
  service: "Service", database: "Database", application: "Application", module: "Module", interface: "Interface",
};
export function kindLabel(kind: string): string {
  return KINDS[kind] ?? kind.replaceAll(/[-_]/g, " ").replace(/^./, c => c.toUpperCase());
}
const VERBS: Record<string, string> = {
  imports: "uses", "require-reference": "uses", "dynamic-import": "loads when needed", references: "uses",
  "declares-dependency": "depends on", "declares-dev-dependency": "uses while developing", "declares-module": "contains module",
  includes: "includes", requests: "sends requests to", reads: "reads from", writes: "writes to", calls: "calls", uses: "uses",
};
/** Verb phrase for a relationship kind, such as "uses" for "imports". */
export function relationshipVerb(kind: string): string {
  return VERBS[kind] ?? kind.replaceAll(/[-_]/g, " ");
}
const ECOSYSTEMS: Record<string, string> = { npm: "npm (JavaScript)", pypi: "PyPI (Python)", go: "Go modules", cargo: "crates.io (Rust)",
  jvm: "the Java ecosystem", gem: "RubyGems", composer: "Packagist (PHP)", pub: "pub.dev (Dart)" };
export const ecosystemLabel = (ecosystem: string) => ECOSYSTEMS[ecosystem] ?? ecosystem;
/** "a, b and c" */
export function listPhrase(items: string[], max = 3): string {
  const shown = items.slice(0, max);
  const more = items.length - shown.length;
  if (more > 0) shown.push(`${more} more`);
  return shown.length <= 1 ? shown.join("") : `${shown.slice(0, -1).join(", ")} and ${shown.at(-1)}`;
}
export const plural = (count: number, one: string, many = `${one}s`) => `${count.toLocaleString("en-US")} ${count === 1 ? one : many}`;
export const percent = (share: number) => `${Math.round(share * 100)}%`;
/** Lowercase for use mid-sentence, keeping acronyms such as API and AI. */
export const lowerName = (name: string) => name.split(" ").map(w => /^[A-Z]{2,}$/.test(w) ? w : w.toLowerCase()).join(" ");
/** "relies" or "rely" to agree with a role name such as "Core logic" or "Integrations". */
export const relies = (name: string) => /s$/i.test(name.trim()) ? "rely" : "relies";
