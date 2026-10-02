/**
 * Dependency and module metadata read from manifests as text. Nothing is installed, executed
 * or fetched; declared versions are not claims about what is installed.
 */
export interface Dependency { name: string; ecosystem: string; dev: boolean }
export interface TsConfig { dir: string; baseUrl?: string; paths?: Record<string, string[]>; pathsDir?: string; extends?: string }
export interface Manifests {
  /** npm package name → directory holding its package.json. */
  npmPackages: Map<string, { dir: string; entries: string[] }>;
  tsconfigs: Map<string, TsConfig>;
  /** Go module path → directory holding go.mod. */
  goModules: Map<string, string>;
  goRequires: Set<string>;
  /** Rust crate name (underscored) → crate directory. */
  crates: Map<string, string>;
  cargoDependencies: Set<string>;
  pythonRoots: Set<string>;
  dartPackages: Map<string, string>;
  dependencies: Map<string, Dependency[]>;
  diagnostics: string[];
}

export const MANIFEST = /(?:^|\/)(?:package\.json|[jt]sconfig(?:\.[\w-]+)*\.json|go\.mod|Cargo\.toml|pyproject\.toml|setup\.py|requirements(?:[\w.-]*)\.txt|Gemfile|composer\.json|pubspec\.yaml)$/;
const dirOf = (path: string) => path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
const baseOf = (path: string) => path.slice(path.lastIndexOf("/") + 1);

export function emptyManifests(): Manifests {
  return { npmPackages: new Map(), tsconfigs: new Map(), goModules: new Map(), goRequires: new Set(), crates: new Map(),
    cargoDependencies: new Set(), pythonRoots: new Set(), dartPackages: new Map(), dependencies: new Map(), diagnostics: [] };
}

/** tsconfig and package metadata allow comments and trailing commas in practice. */
export function parseJsonc(text: string): unknown {
  let out = "";
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (c === '"') {
      let j = i + 1;
      while (j < text.length && text[j] !== '"') j += text[j] === "\\" ? 2 : 1;
      out += text.slice(i, j + 1); i = j;
    } else if (c === "/" && text[i + 1] === "/") {
      while (i < text.length && text[i] !== "\n") i++;
      out += "\n";
    } else if (c === "/" && text[i + 1] === "*") {
      const end = text.indexOf("*/", i + 2);
      i = end < 0 ? text.length : end + 1;
    } else out += c;
  }
  return JSON.parse(out.replace(/,(\s*[}\]])/g, "$1"));
}
const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const strings = (value: unknown): string[] => Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];

/** Minimal TOML reader for dependency tables: table headers, keys and string arrays. */
function tomlTables(text: string): Map<string, { keys: Map<string, string> }> {
  const tables = new Map<string, { keys: Map<string, string> }>();
  let current = tables.set("", { keys: new Map() }).get("")!;
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.replace(/\s+#.*$/, "").trim();
    if (!line || line.startsWith("#")) continue;
    const header = /^\[\[?([^\]]+)\]\]?$/.exec(line);
    if (header) {
      const name = header[1]!.trim().replace(/\s*\.\s*/g, ".");
      current = tables.get(name) ?? tables.set(name, { keys: new Map() }).get(name)!;
      continue;
    }
    const pair = /^("?[\w.-]+"?)\s*=\s*(.*)$/.exec(line);
    if (!pair) continue;
    let value = pair[2]!;
    // Arrays and inline tables may span lines; collect until brackets balance.
    const balance = (s: string) => (s.match(/[[{]/g)?.length ?? 0) - (s.match(/[\]}]/g)?.length ?? 0);
    while (balance(value) > 0 && i + 1 < lines.length) value += " " + lines[++i]!.replace(/\s+#.*$/, "").trim();
    current.keys.set(pair[1]!.replaceAll('"', ""), value);
  }
  return tables;
}
const quoted = (value: string) => [...value.matchAll(/"([^"]*)"|'([^']*)'/g)].map(m => m[1] ?? m[2] ?? "");
const pep508 = (requirement: string) => /^\s*([A-Za-z0-9][A-Za-z0-9._-]*)/.exec(requirement)?.[1]?.toLowerCase().replaceAll("_", "-");

export function readManifest(path: string, text: string, manifests: Manifests): void {
  const name = baseOf(path), dir = dirOf(path);
  const deps: Dependency[] = [];
  const add = (dependency: string | undefined, ecosystem: string, dev: boolean) => {
    if (dependency && dependency.length <= 200) deps.push({ name: dependency, ecosystem, dev });
  };
  try {
    if (name === "package.json") {
      const pkg = record(JSON.parse(text));
      for (const dep of Object.keys(record(pkg.dependencies))) add(dep, "npm", false);
      for (const dep of Object.keys(record(pkg.devDependencies))) add(dep, "npm", true);
      if (typeof pkg.name === "string" && pkg.name) {
        const exportsField = pkg.exports;
        const dot = typeof exportsField === "string" ? exportsField : record(record(exportsField)["."] ?? exportsField);
        const entries = [...(typeof dot === "string" ? [dot] : ["source", "import", "default", "require", "types"].map(k => dot[k]).filter((v): v is string => typeof v === "string")),
          ...["source", "module", "main", "types"].map(k => pkg[k]).filter((v): v is string => typeof v === "string")];
        if (!manifests.npmPackages.has(pkg.name)) manifests.npmPackages.set(pkg.name, { dir, entries });
      }
    } else if (/^[jt]sconfig/.test(name)) {
      const config = record(parseJsonc(text));
      const options = record(config.compilerOptions);
      const paths = record(options.paths);
      const entry: TsConfig = { dir };
      if (typeof options.baseUrl === "string") entry.baseUrl = options.baseUrl;
      if (Object.keys(paths).length) {
        entry.paths = Object.fromEntries(Object.entries(paths).map(([k, v]) => [k, strings(v)]));
        entry.pathsDir = dir;
      }
      if (typeof config.extends === "string") entry.extends = config.extends;
      // tsconfig.json governs its directory; variants only fill in when no main config exists.
      if (name === "tsconfig.json" || name === "jsconfig.json" || !manifests.tsconfigs.has(dir)) manifests.tsconfigs.set(dir, entry);
      manifests.tsconfigs.set(path, entry);
    } else if (name === "go.mod") {
      const module = /^\s*module\s+(\S+)/m.exec(text)?.[1];
      if (module) manifests.goModules.set(module.replaceAll('"', ""), dir);
      const requires = [...text.matchAll(/^\s*require\s+([^\s(]+)\s+\S+(.*)$/gm), ...[...text.matchAll(/^\s*require\s*\(([\s\S]*?)\)/gm)]
        .flatMap(block => [...block[1]!.matchAll(/^\s*([^\s/][^\s]*)\s+\S+(.*)$/gm)])];
      for (const match of requires) {
        if (/\/\/\s*indirect/.test(match[2] ?? "")) continue;
        manifests.goRequires.add(match[1]!);
        add(match[1], "go", false);
      }
    } else if (name === "Cargo.toml") {
      const tables = tomlTables(text);
      const crate = tables.get("package")?.keys.get("name") ?? tables.get("lib")?.keys.get("name");
      if (crate) manifests.crates.set(quoted(crate)[0]?.replaceAll("-", "_") ?? "", dir);
      for (const [table, { keys }] of tables) {
        const dotted = /^(?:target\..+\.)?(dev-|build-)?dependencies\.([\w-]+)$/.exec(table);
        if (dotted) { add(dotted[2], "cargo", !!dotted[1]); continue; }
        const section = /^(?:workspace\.|target\..+\.)?(dev-|build-)?dependencies$/.exec(table);
        if (!section) continue;
        for (const key of keys.keys()) add(key.split(".")[0], "cargo", !!section[1]);
      }
      for (const dep of deps) manifests.cargoDependencies.add(dep.name.replaceAll("-", "_"));
    } else if (name === "pyproject.toml") {
      manifests.pythonRoots.add(dir); manifests.pythonRoots.add(dir ? `${dir}/src` : "src");
      const tables = tomlTables(text);
      for (const value of quoted(tables.get("project")?.keys.get("dependencies") ?? "")) add(pep508(value), "pypi", false);
      for (const value of tables.get("project.optional-dependencies")?.keys.values() ?? []) for (const req of quoted(value)) add(pep508(req), "pypi", true);
      for (const [table, { keys }] of tables) {
        const poetry = /^tool\.poetry\.(?:group\.[\w-]+\.)?(dev-)?dependencies$/.exec(table);
        if (!poetry) continue;
        for (const key of keys.keys()) if (key !== "python") add(key.toLowerCase(), "pypi", !!poetry[1] || table.includes(".group."));
      }
    } else if (name === "setup.py") {
      manifests.pythonRoots.add(dir); manifests.pythonRoots.add(dir ? `${dir}/src` : "src");
    } else if (name.startsWith("requirements")) {
      const dev = /dev|test|lint|doc/i.test(name);
      for (const line of text.split(/\r?\n/)) {
        const clean = line.replace(/\s+#.*$/, "").trim();
        if (!clean || /^[#-]/.test(clean) || clean.includes("://")) continue;
        add(pep508(clean), "pypi", dev);
      }
    } else if (name === "Gemfile") {
      let devDepth = 0;
      for (const line of text.split(/\r?\n/)) {
        if (/^\s*group\b.*:(?:development|test)\b.*\bdo\b/.test(line)) devDepth++;
        else if (devDepth && /^\s*end\b/.test(line)) devDepth--;
        const gem = /^\s*gem\s+["']([\w.-]+)["']/.exec(line)?.[1];
        add(gem, "gem", devDepth > 0);
      }
    } else if (name === "composer.json") {
      const composer = record(JSON.parse(text));
      for (const [field, dev] of [["require", false], ["require-dev", true]] as const)
        for (const dep of Object.keys(record(composer[field]))) if (dep.includes("/")) add(dep, "composer", dev);
    } else if (name === "pubspec.yaml") {
      const pubName = /^name:\s*([\w]+)/m.exec(text)?.[1];
      if (pubName) manifests.dartPackages.set(pubName, dir);
      let section: string | undefined;
      for (const line of text.split(/\r?\n/)) {
        const top = /^([\w]+):/.exec(line);
        if (top) { section = top[1]; continue; }
        const key = /^ {2}([\w]+):/.exec(line)?.[1];
        if (key && (section === "dependencies" || section === "dev_dependencies")) add(key, "pub", section === "dev_dependencies");
      }
    }
  } catch {
    manifests.diagnostics.push(`Could not read manifest: ${path}`);
  }
  if (deps.length) manifests.dependencies.set(path, deps);
}
