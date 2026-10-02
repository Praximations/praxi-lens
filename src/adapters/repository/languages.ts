import { parse } from "@babel/parser";
import type { Manifests, TsConfig } from "./manifests.js";

const EXTENSIONS: Record<string, string> = {
  ts: "TypeScript", tsx: "TypeScript", mts: "TypeScript", cts: "TypeScript",
  js: "JavaScript", jsx: "JavaScript", mjs: "JavaScript", cjs: "JavaScript",
  vue: "Vue", svelte: "Svelte", astro: "Astro", py: "Python", pyi: "Python", ipynb: "Jupyter Notebook",
  go: "Go", rs: "Rust", java: "Java", kt: "Kotlin", kts: "Kotlin", scala: "Scala", groovy: "Groovy", gradle: "Groovy",
  c: "C", h: "C", cc: "C++", cpp: "C++", cxx: "C++", hpp: "C++", hh: "C++", hxx: "C++", ipp: "C++",
  m: "Objective-C", mm: "Objective-C", cs: "C#", fs: "F#", vb: "Visual Basic", swift: "Swift", dart: "Dart",
  rb: "Ruby", rake: "Ruby", gemspec: "Ruby", php: "PHP", lua: "Lua", ex: "Elixir", exs: "Elixir", erl: "Erlang",
  hs: "Haskell", clj: "Clojure", r: "R", jl: "Julia", zig: "Zig", sol: "Solidity", ml: "OCaml", pl: "Perl",
  sh: "Shell", bash: "Shell", zsh: "Shell", fish: "Shell", ps1: "PowerShell", bat: "Batch",
  sql: "SQL", prisma: "Prisma", graphql: "GraphQL", gql: "GraphQL", proto: "Protocol Buffers",
  html: "HTML", htm: "HTML", css: "CSS", scss: "Sass", sass: "Sass", less: "Less",
  md: "Markdown", mdx: "Markdown", rst: "reStructuredText", txt: "Text", adoc: "AsciiDoc",
  json: "JSON", jsonc: "JSON", yaml: "YAML", yml: "YAML", toml: "TOML", xml: "XML", ini: "INI",
  tf: "Terraform", hcl: "HCL", nix: "Nix", cmake: "CMake", wasm: "WebAssembly", ino: "Arduino",
  v: "Verilog", sv: "SystemVerilog", vhd: "VHDL", vhdl: "VHDL", kicad_pcb: "KiCad", scad: "OpenSCAD",
  png: "Image", jpg: "Image", jpeg: "Image", gif: "Image", svg: "Image", webp: "Image", ico: "Image", avif: "Image",
  woff: "Font", woff2: "Font", ttf: "Font", otf: "Font", mp3: "Audio", wav: "Audio", mp4: "Video", webm: "Video",
};
const NAMED: Record<string, string> = {
  Dockerfile: "Dockerfile", Makefile: "Makefile", Gemfile: "Ruby", Rakefile: "Ruby", Procfile: "Procfile",
  "CMakeLists.txt": "CMake", Jenkinsfile: "Groovy", Vagrantfile: "Ruby", BUILD: "Bazel", WORKSPACE: "Bazel",
};
export function languageOf(path: string): string | undefined {
  const base = path.slice(path.lastIndexOf("/") + 1);
  if (NAMED[base]) return NAMED[base];
  if (/^Dockerfile\./.test(base)) return "Dockerfile";
  const dot = base.lastIndexOf(".");
  return dot > 0 ? EXTENSIONS[base.slice(dot + 1).toLowerCase()] : undefined;
}
/** Languages whose references Lens reads. Everything else contributes structure only. */
export const ANALYZED_LANGUAGES = new Set(["TypeScript", "JavaScript", "Vue", "Svelte", "Astro", "Python", "Go", "Rust",
  "Java", "Kotlin", "Scala", "Groovy", "C", "C++", "Objective-C", "Ruby", "PHP", "Dart"]);
/** Source a person would call "code", used for size and language summaries. */
export const CODE_LANGUAGES = new Set([...ANALYZED_LANGUAGES, "C#", "F#", "Visual Basic", "Swift", "Lua", "Elixir", "Erlang",
  "Haskell", "Clojure", "R", "Julia", "Zig", "Solidity", "OCaml", "Perl", "Shell", "PowerShell", "SQL", "Jupyter Notebook",
  "Arduino", "Verilog", "SystemVerilog", "VHDL"]);

export interface Context {
  paths: ReadonlySet<string>;
  dirs: ReadonlySet<string>;
  /** File base name → full paths. */
  byName: ReadonlyMap<string, string[]>;
  manifests: Manifests;
  pythonRoots: string[];
}
export type Target = { type: "file"; path: string } | { type: "dir"; path: string }
  | { type: "package"; name: string; ecosystem: string } | { type: "standard" } | { type: "unresolved" };
export interface Reference { kind: string; specifier: string; target: Target }
export interface Extraction { references: Reference[]; exports: string[]; lines: number; failed: boolean }

const STANDARD: Target = { type: "standard" };
const UNRESOLVED: Target = { type: "unresolved" };
export const dirOf = (path: string) => path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
const baseOf = (path: string) => path.slice(path.lastIndexOf("/") + 1);
/** Joins repository paths; undefined when the result would leave the repository root. */
export function join(base: string, relative: string): string | undefined {
  const parts = base ? base.split("/") : [];
  for (const segment of relative.split("/")) {
    if (segment === "..") { if (!parts.length) return undefined; parts.pop(); }
    else if (segment && segment !== ".") parts.push(segment);
  }
  return parts.join("/");
}

interface Syntax { line: string[]; block?: [string, string][]; quotes: string[]; triple?: boolean; blankStrings?: boolean }
/** Removes comments (and optionally string contents) so commented-out code never becomes a reference. */
export function clean(source: string, syntax: Syntax): string {
  const starts = new Set([...syntax.line, ...(syntax.block ?? []).map(b => b[0]), ...syntax.quotes].map(t => t[0]!));
  const parts: string[] = [];
  const blank = (s: string) => s.replace(/[^\n]/g, " ");
  let last = 0;
  for (let i = 0; i < source.length;) {
    const c = source[i]!;
    if (!starts.has(c)) { i++; continue; }
    if (syntax.line.some(t => source.startsWith(t, i))) {
      parts.push(source.slice(last, i));
      const end = source.indexOf("\n", i);
      i = last = end < 0 ? source.length : end;
      continue;
    }
    const block = syntax.block?.find(([open]) => source.startsWith(open, i));
    if (block) {
      const end = source.indexOf(block[1], i + block[0].length);
      const stop = end < 0 ? source.length : end + block[1].length;
      parts.push(source.slice(last, i), blank(source.slice(i, stop)));
      i = last = stop;
      continue;
    }
    if (syntax.quotes.includes(c)) {
      let stop: number;
      if (syntax.triple && source.startsWith(c.repeat(3), i)) {
        const end = source.indexOf(c.repeat(3), i + 3);
        stop = end < 0 ? source.length : end + 3;
        parts.push(source.slice(last, i), blank(source.slice(i, stop)));
        i = last = stop;
        continue;
      }
      let j = i + 1;
      while (j < source.length && source[j] !== c && (source[j] !== "\n" || c === "`")) j += source[j] === "\\" ? 2 : 1;
      stop = Math.min(source.length, j + 1);
      if (syntax.blankStrings) { parts.push(source.slice(last, i), c + blank(source.slice(i + 1, stop - 1)) + c); last = stop; }
      i = stop;
      continue;
    }
    i++;
  }
  parts.push(source.slice(last));
  return parts.join("");
}
const C_LIKE: Syntax = { line: ["//"], block: [["/*", "*/"]], quotes: ['"', "'"] };

const NODE_BUILTINS = new Set(["assert", "async_hooks", "buffer", "child_process", "cluster", "console", "constants", "crypto",
  "dgram", "diagnostics_channel", "dns", "domain", "events", "fs", "http", "http2", "https", "inspector", "module", "net", "os",
  "path", "perf_hooks", "process", "punycode", "querystring", "readline", "repl", "stream", "string_decoder", "sys", "timers",
  "tls", "trace_events", "tty", "url", "util", "v8", "vm", "wasi", "worker_threads", "zlib"]);
const PYTHON_STANDARD = new Set(("__future__ _thread abc aifc argparse array ast asynchat asyncio asyncore atexit audioop base64 bdb " +
  "binascii bisect builtins bz2 cProfile calendar cgi cgitb chunk cmath cmd code codecs codeop collections colorsys compileall " +
  "concurrent configparser contextlib contextvars copy copyreg crypt csv ctypes curses dataclasses datetime dbm decimal difflib dis " +
  "distutils doctest email encodings ensurepip enum errno faulthandler fcntl filecmp fileinput fnmatch fractions ftplib functools gc " +
  "getopt getpass gettext glob graphlib grp gzip hashlib heapq hmac html http imaplib imghdr imp importlib inspect io ipaddress " +
  "itertools json keyword lib2to3 linecache locale logging lzma mailbox mailcap marshal math mimetypes mmap modulefinder msvcrt " +
  "multiprocessing netrc nntplib ntpath numbers opcode operator optparse os pathlib pdb pickle pickletools pipes pkgutil platform " +
  "plistlib poplib posix posixpath pprint profile pstats pty pwd py_compile pyclbr pydoc queue quopri random re readline reprlib " +
  "resource rlcompleter runpy sched secrets select selectors shelve shlex shutil signal site smtplib sndhdr socket socketserver " +
  "spwd sqlite3 ssl stat statistics string stringprep struct subprocess sunau symtable sys sysconfig syslog tabnanny tarfile " +
  "telnetlib tempfile termios textwrap threading time timeit tkinter token tokenize tomllib trace traceback tracemalloc tty " +
  "turtle types typing unicodedata unittest urllib uu uuid venv warnings wave weakref webbrowser winreg winsound wsgiref xdrlib " +
  "xml xmlrpc zipapp zipfile zipimport zlib zoneinfo").split(" "));
const PYTHON_ALIASES: Record<string, string> = { yaml: "pyyaml", sklearn: "scikit-learn", cv2: "opencv-python", PIL: "pillow",
  bs4: "beautifulsoup4", dateutil: "python-dateutil", dotenv: "python-dotenv", jwt: "pyjwt", google: "google", attr: "attrs" };
const RUBY_STANDARD = new Set(("abbrev base64 benchmark bigdecimal cgi csv date delegate digest English erb etc fileutils find " +
  "forwardable io json logger matrix monitor net open-uri open3 openssl optparse ostruct pathname pp prettyprint pstore psych " +
  "racc rdoc readline resolv ripper securerandom set shellwords singleton socket stringio strscan tempfile time timeout tmpdir " +
  "tsort un uri weakref yaml zlib").split(" "));
const JVM_STANDARD = new Set(["java", "javax", "jdk", "sun", "kotlin", "scala", "android", "dalvik", "groovy"]);

/** Reads one file's references as data. Nothing is executed and no import is fetched. */
export function extract(path: string, text: string, ctx: Context): Extraction {
  const language = languageOf(path);
  const references: Reference[] = [];
  const exports = new Set<string>();
  const add = (kind: string, specifier: string, target: Target) => {
    if (target.type === "file" && target.path === path) return;
    if (specifier && specifier.length <= 200) references.push({ kind, specifier, target });
  };
  const capture = (source: string, pattern: RegExp) => { for (const m of source.matchAll(pattern)) { const name = m.slice(1).find(Boolean); if (name) exports.add(name); } };
  let failed = false;
  try {
    switch (language) {
      case "TypeScript": case "JavaScript": case "Vue": case "Svelte": case "Astro":
        javascript(path, text, language, ctx, add, exports); break;
      case "Python": {
        const code = clean(text, { line: ["#"], quotes: ['"', "'"], triple: true, blankStrings: true });
        python(path, code, ctx, add);
        capture(code, /^(?:async\s+)?def\s+([A-Za-z]\w*)|^class\s+([A-Za-z]\w*)/gm); break;
      }
      case "Go": {
        const code = clean(text, { ...C_LIKE, quotes: ['"', "'", "`"] });
        go(code, ctx, add);
        capture(code, /^func\s+(?:\([^)]*\)\s*)?([A-Z]\w*)|^type\s+([A-Z]\w*)/gm); break;
      }
      case "Rust": {
        const code = clean(text, { ...C_LIKE, quotes: ['"'], blankStrings: true });
        rust(path, code, ctx, add);
        capture(code, /^\s*pub\s+(?:async\s+|unsafe\s+|const\s+)*(?:fn|struct|enum|trait|type|union)\s+(\w+)/gm); break;
      }
      case "Java": case "Kotlin": case "Scala": case "Groovy": {
        const code = clean(text, { ...C_LIKE, triple: true, blankStrings: true });
        jvm(code, ctx, add);
        capture(code, /^(?:public\s+|internal\s+)?(?:(?:abstract|final|sealed|data|open|enum|inner|case)\s+)*(?:class|interface|record|object|trait)\s+(\w+)|^fun\s+(?:<[^>]*>\s*)?(\w+)/gm); break;
      }
      case "C": case "C++": case "Objective-C":
        native(path, clean(text, C_LIKE), ctx, add); break;
      case "Ruby": {
        const code = clean(text, { line: ["#"], block: [["=begin", "=end"]], quotes: ['"', "'"] });
        ruby(path, code, ctx, add);
        capture(code, /^\s*(?:class|module)\s+([A-Z][\w:]*)/gm); break;
      }
      case "PHP": {
        const code = clean(text, { line: ["//", "#"], block: [["/*", "*/"]], quotes: ['"', "'"] });
        php(path, code, ctx, add);
        capture(code, /^\s*(?:(?:final|abstract|readonly)\s+)*(?:class|interface|trait|enum)\s+(\w+)|^function\s+(\w+)/gm); break;
      }
      case "Dart": {
        const code = clean(text, { ...C_LIKE, triple: true });
        dart(path, code, ctx, add);
        capture(code, /^(?:abstract\s+|sealed\s+|base\s+|final\s+)*(?:class|mixin|enum|extension)\s+(\w+)/gm); break;
      }
    }
  } catch { failed = true; }
  return { references, exports: [...exports].slice(0, 60), lines: text ? text.split("\n").length : 0, failed };
}
type Add = (kind: string, specifier: string, target: Target) => void;

// ---------- JavaScript and TypeScript ----------
const JS_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".mts", ".cts", ".vue", ".svelte", ".d.ts"];
/** Mirrors TypeScript/bundler lookup order: exact file, extensions, then directory index. */
function resolveScript(candidate: string | undefined, ctx: Context): string | undefined {
  if (candidate === undefined) return undefined;
  if (ctx.paths.has(candidate)) return candidate;
  const stem = candidate.replace(/\.[cm]?jsx?$/, "");
  for (const ext of JS_EXTENSIONS) if (ctx.paths.has(stem + ext)) return stem + ext;
  for (const ext of JS_EXTENSIONS) if (ctx.paths.has(`${candidate}/index${ext}`)) return `${candidate}/index${ext}`;
  return undefined;
}
function tsconfigFor(path: string, ctx: Context): { baseUrl?: string; paths?: Record<string, string[]>; pathsBase?: string } | undefined {
  let dir = dirOf(path);
  let config: TsConfig | undefined;
  for (;;) {
    config = ctx.manifests.tsconfigs.get(dir);
    if (config || !dir) break;
    dir = dirOf(dir);
  }
  let baseUrl: string | undefined, paths: Record<string, string[]> | undefined, pathsDir: string | undefined;
  for (let hops = 0; config && hops < 6; hops++) {
    if (baseUrl === undefined && config.baseUrl !== undefined) baseUrl = join(config.dir, config.baseUrl);
    if (paths === undefined && config.paths) { paths = config.paths; pathsDir = config.pathsDir; }
    if (!config.extends?.startsWith(".")) break;
    const next = join(config.dir, config.extends.endsWith(".json") ? config.extends : `${config.extends}.json`);
    config = next === undefined ? undefined : ctx.manifests.tsconfigs.get(next);
  }
  return baseUrl === undefined && !paths ? undefined : { baseUrl, paths, pathsBase: baseUrl ?? pathsDir };
}
function resolveBare(path: string, specifier: string, ctx: Context): Target {
  const config = tsconfigFor(path, ctx);
  if (config?.paths) {
    let best: { star: string; targets: string[]; prefix: number } | undefined;
    for (const [pattern, targets] of Object.entries(config.paths)) {
      const star = pattern.indexOf("*");
      const prefix = star < 0 ? pattern : pattern.slice(0, star), suffix = star < 0 ? "" : pattern.slice(star + 1);
      const matches = star < 0 ? specifier === pattern
        : specifier.startsWith(prefix) && specifier.endsWith(suffix) && specifier.length >= prefix.length + suffix.length;
      if (matches && (!best || prefix.length > best.prefix))
        best = { star: star < 0 ? "" : specifier.slice(prefix.length, specifier.length - suffix.length), targets, prefix: prefix.length };
    }
    for (const target of best?.targets ?? []) {
      const file = resolveScript(join(config.pathsBase ?? "", target.replace("*", best!.star)), ctx);
      if (file) return { type: "file", path: file };
    }
  }
  if (config?.baseUrl !== undefined) {
    const file = resolveScript(join(config.baseUrl, specifier), ctx);
    if (file) return { type: "file", path: file };
  }
  if (specifier.startsWith("node:") || NODE_BUILTINS.has(specifier.split("/")[0]!)) return STANDARD;
  if (!/^(?:@[^/@]+\/[^/]+|[a-zA-Z0-9][\w.-]*)(?:\/.*)?$/.test(specifier)) return UNRESOLVED;
  const name = specifier.startsWith("@") ? specifier.split("/").slice(0, 2).join("/") : specifier.split("/")[0]!;
  const workspace = ctx.manifests.npmPackages.get(name);
  if (workspace) {
    const rest = specifier.slice(name.length + 1);
    // Monorepo packages resolve to their own source, never to a published copy.
    const options = rest ? [join(workspace.dir, rest), join(workspace.dir, `src/${rest}`)]
      : [...workspace.entries.map(e => join(workspace.dir, e)), join(workspace.dir, "src/index"), join(workspace.dir, "index")];
    for (const option of options) {
      const file = resolveScript(option, ctx);
      if (file) return { type: "file", path: file };
    }
    if (workspace.dir) return { type: "dir", path: workspace.dir };
  }
  return { type: "package", name, ecosystem: "npm" };
}
type AstNode = { type: string; [key: string]: unknown };
const isNode = (value: unknown): value is AstNode => !!value && typeof value === "object" && typeof (value as AstNode).type === "string";
function javascript(path: string, text: string, language: string, ctx: Context, add: Add, exports: Set<string>) {
  let source = text;
  if (language !== "TypeScript" && language !== "JavaScript") {
    const blocks = [...text.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]!);
    const front = language === "Astro" ? /^---\r?\n([\s\S]*?)\r?\n---/.exec(text)?.[1] : undefined;
    source = [front ?? "", ...blocks].join("\n;\n");
  }
  const ast = parse(source, { sourceType: "unambiguous", plugins: ["typescript", "jsx"], createImportExpressions: true, errorRecovery: false });
  const reference = (specifier: string, kind: string) => {
    if (specifier.startsWith(".")) {
      const file = resolveScript(join(dirOf(path), specifier), ctx);
      add(kind, specifier, file ? { type: "file", path: file } : UNRESOLVED);
    } else add(kind, specifier, resolveBare(path, specifier, ctx));
  };
  const walk = (node: AstNode) => {
    if (node.type === "ImportDeclaration" || node.type === "ExportNamedDeclaration" || node.type === "ExportAllDeclaration" || node.type === "ImportExpression") {
      const source = node.source;
      if (isNode(source) && source.type === "StringLiteral" && typeof source.value === "string")
        reference(source.value, node.type === "ImportExpression" ? "dynamic-import" : "imports");
    }
    if (node.type === "CallExpression" && isNode(node.callee) && node.callee.type === "Identifier" && node.callee.name === "require" && Array.isArray(node.arguments)) {
      const arg = node.arguments[0];
      if (isNode(arg) && arg.type === "StringLiteral" && typeof arg.value === "string") reference(arg.value, "require-reference");
    }
    if (node.type === "ExportDefaultDeclaration") exports.add("default");
    if (node.type === "ExportNamedDeclaration" && isNode(node.declaration)) {
      const declaration = node.declaration;
      if (isNode(declaration.id) && typeof declaration.id.name === "string") exports.add(declaration.id.name);
      if (Array.isArray(declaration.declarations)) for (const d of declaration.declarations)
        if (isNode(d) && isNode(d.id) && typeof d.id.name === "string") exports.add(d.id.name);
    }
    for (const value of Object.values(node)) {
      if (isNode(value)) walk(value);
      else if (Array.isArray(value)) for (const child of value) if (isNode(child)) walk(child);
    }
  };
  walk(ast as unknown as AstNode);
}

// ---------- Python ----------
function pythonModule(base: string, ctx: Context): string | undefined {
  for (const candidate of [`${base}.py`, `${base}/__init__.py`, `${base}.pyi`]) if (ctx.paths.has(candidate)) return candidate;
  return undefined;
}
function python(path: string, code: string, ctx: Context, add: Add) {
  const lines = code.split("\n");
  const absolute = (module: string): string | undefined => {
    const relative = module.replaceAll(".", "/");
    const found = new Set<string>();
    for (const root of ctx.pythonRoots) {
      const file = pythonModule(root ? `${root}/${relative}` : relative, ctx);
      if (file) found.add(file);
    }
    if (found.size <= 1) return [...found][0];
    // Prefer the source root that also contains the importing file.
    const near = [...found].filter(f => path.startsWith(f.split("/").slice(0, -relative.split("/").length - 1).join("/")));
    return near.length === 1 ? near[0] : undefined;
  };
  const external = (module: string, specifier: string) => {
    const top = module.split(".")[0]!;
    add("imports", specifier, PYTHON_STANDARD.has(top) ? STANDARD : top ? { type: "package", name: PYTHON_ALIASES[top] ?? top.toLowerCase().replaceAll("_", "-"), ecosystem: "pypi" } : UNRESOLVED);
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const plain = /^\s*import\s+(.+)$/.exec(line);
    if (plain) {
      for (const part of plain[1]!.split(",")) {
        const module = part.trim().split(/\s+as\s+/)[0]!.trim();
        if (!/^[A-Za-z_][\w.]*$/.test(module)) continue;
        const file = absolute(module);
        if (file) add("imports", module, { type: "file", path: file }); else external(module, module);
      }
      continue;
    }
    const from = /^\s*from\s+(\.*)([\w.]*)\s+import\s+(.*)$/.exec(line);
    if (!from) continue;
    let names = from[3]!;
    if (names.includes("(") && !names.includes(")")) while (i + 1 < lines.length && !names.includes(")")) names += " " + lines[++i];
    const imported = names.replace(/[()\\]/g, " ").split(",").map(n => n.trim().split(/\s+as\s+/)[0]!.trim()).filter(n => /^\w+$/.test(n));
    const level = from[1]!.length, module = from[2]!;
    const specifier = from[1]! + module;
    let base: string | undefined;
    if (level) {
      base = dirOf(path);
      for (let up = 1; up < level && base !== undefined; up++) base = base ? dirOf(base) : undefined;
      if (base === undefined) { add("imports", specifier, UNRESOLVED); continue; }
      if (module) base = join(base, module.replaceAll(".", "/"));
    } else {
      const file = absolute(module);
      if (!file) {
        // "from package import module" may still name an internal submodule directory.
        const packageDir = ctx.pythonRoots.map(r => join(r, module.replaceAll(".", "/"))).find(d => d !== undefined && ctx.dirs.has(d));
        if (packageDir === undefined) { external(module, specifier); continue; }
        base = packageDir;
      } else base = file.endsWith("/__init__.py") ? dirOf(file) : file.replace(/\.pyi?$/, "");
    }
    let linked = false;
    for (const name of imported) {
      const submodule = base === undefined ? undefined : pythonModule(base ? `${base}/${name}` : name, ctx);
      if (submodule) { add("imports", `${specifier}.${name}`, { type: "file", path: submodule }); linked = true; }
    }
    const own = base === undefined ? undefined : pythonModule(base, ctx);
    if (own) add("imports", specifier || ".", { type: "file", path: own });
    else if (!linked) add("imports", specifier || ".", UNRESOLVED);
  }
}

// ---------- Go ----------
function go(code: string, ctx: Context, add: Add) {
  const specs = new Set<string>();
  for (const block of code.matchAll(/\bimport\s*\(([^)]*)\)/g)) for (const m of block[1]!.matchAll(/"([^"\n]+)"|`([^`\n]+)`/g)) specs.add(m[1] ?? m[2]!);
  for (const m of code.matchAll(/\bimport\s+(?:[\w.]+\s+)?(?:"([^"\n]+)"|`([^`\n]+)`)/g)) specs.add(m[1] ?? m[2]!);
  for (const spec of specs) {
    let module: string | undefined;
    for (const candidate of ctx.manifests.goModules.keys())
      if ((spec === candidate || spec.startsWith(candidate + "/")) && (!module || candidate.length > module.length)) module = candidate;
    if (module !== undefined) {
      const dir = join(ctx.manifests.goModules.get(module)!, spec.slice(module.length + 1));
      if (dir) add("imports", spec, ctx.dirs.has(dir) ? { type: "dir", path: dir } : UNRESOLVED);
      continue;
    }
    if (!spec.split("/")[0]!.includes(".")) { add("imports", spec, STANDARD); continue; }
    let name: string | undefined;
    for (const required of ctx.manifests.goRequires) if ((spec === required || spec.startsWith(required + "/")) && (!name || required.length > name.length)) name = required;
    const parts = spec.split("/");
    add("imports", spec, { type: "package", name: name ?? parts.slice(0, /^(?:github\.com|gitlab\.com|bitbucket\.org|golang\.org)$/.test(parts[0]!) ? 3 : 2).join("/"), ecosystem: "go" });
  }
}

// ---------- Rust ----------
function rust(path: string, code: string, ctx: Context, add: Add) {
  const base = baseOf(path);
  const moduleDir = /^(?:lib|main|mod)\.rs$/.test(base) || /(?:^|\/)src\/bin\//.test(path) || /(?:^|\/)build\.rs$/.test(path)
    ? dirOf(path) : join(dirOf(path), base.replace(/\.rs$/, ""))!;
  const moduleFile = (dir: string, segments: string[]) => {
    for (let k = segments.length; k >= 1; k--) {
      const p = join(dir, segments.slice(0, k).join("/"));
      if (p === undefined) continue;
      for (const candidate of [`${p}.rs`, `${p}/mod.rs`]) if (ctx.paths.has(candidate)) return candidate;
    }
    return undefined;
  };
  let crateDir = dirOf(path);
  while (crateDir && !ctx.paths.has(`${crateDir}/Cargo.toml`)) crateDir = dirOf(crateDir);
  const crateSrc = join(crateDir, "src")!;
  for (const m of code.matchAll(/^\s*(?:pub(?:\([^)]*\))?\s+)?mod\s+(\w+)\s*;/gm)) {
    const file = moduleFile(moduleDir, [m[1]!]);
    add("declares-module", m[1]!, file ? { type: "file", path: file } : UNRESOLVED);
  }
  const uses = [...code.matchAll(/^\s*(?:pub(?:\([^)]*\))?\s+)?use\s+(?:::)?([\w]+(?:::[\w]+)*)/gm)].map(m => m[1]!)
    .concat([...code.matchAll(/^\s*extern\s+crate\s+(\w+)/gm)].map(m => m[1]!));
  for (const use of new Set(uses)) {
    const segments = use.split("::");
    const head = segments[0]!;
    if (["std", "core", "alloc", "proc_macro", "test"].includes(head)) { add("imports", use, STANDARD); continue; }
    let dir: string | undefined, rest = segments.slice(1);
    if (head === "crate") dir = crateSrc;
    else if (head === "self") dir = moduleDir;
    else if (head === "super") {
      dir = dirOf(moduleDir);
      while (rest[0] === "super") { dir = dirOf(dir); rest = rest.slice(1); }
    } else if (ctx.manifests.crates.has(head) && ctx.manifests.crates.get(head) !== crateDir) {
      dir = join(ctx.manifests.crates.get(head)!, "src");
    } else {
      // A bare first segment is a module in scope (current or crate root) or another crate.
      const local = moduleFile(moduleDir, [head]) ? moduleDir : moduleFile(crateSrc, [head]) ? crateSrc : undefined;
      if (local !== undefined) { add("imports", use, { type: "file", path: moduleFile(local, segments)! }); continue; }
      add("imports", use, /^[a-z]/.test(head) ? { type: "package", name: head, ecosystem: "cargo" } : UNRESOLVED);
      continue;
    }
    let file = dir === undefined ? undefined : moduleFile(dir, rest);
    if (!file && dir !== undefined && head !== "self" && head !== "super") file = [`${dir}/lib.rs`, `${dir}/main.rs`].find(p => ctx.paths.has(p));
    add("imports", use, file ? { type: "file", path: file } : UNRESOLVED);
  }
}

// ---------- Java, Kotlin, Scala, Groovy ----------
const JVM_SOURCE = /\.(?:java|kt|kts|scala|groovy)$/;
function jvm(code: string, ctx: Context, add: Add) {
  for (const m of code.matchAll(/^\s*import\s+(static\s+)?([\w.]+?)(\.\*|\._|\.\{[^}]*\})?\s*(?:as\s+\w+)?\s*;?\s*$/gm)) {
    const fqn = m[2]!;
    const segments = fqn.split(".");
    if (JVM_STANDARD.has(segments[0]!)) { add("imports", fqn, STANDARD); continue; }
    let target: Target | undefined;
    if (m[3]) {
      const dirSuffix = segments.join("/");
      const dirs = [...ctx.dirs].filter(d => d === dirSuffix || d.endsWith("/" + dirSuffix));
      if (dirs.length === 1) target = { type: "dir", path: dirs[0]! };
    }
    for (let drop = 0; !target && drop <= (m[1] ? 2 : 1) && segments.length - drop >= 2; drop++) {
      const parts = segments.slice(0, segments.length - drop);
      const suffix = parts.join("/");
      const candidates = [".java", ".kt", ".kts", ".scala", ".groovy"].flatMap(ext => ctx.byName.get(parts.at(-1)! + ext) ?? []).filter(p => {
        const stem = p.replace(JVM_SOURCE, "");
        return stem !== p && (stem === suffix || stem.endsWith("/" + suffix));
      });
      if (candidates.length === 1) target = { type: "file", path: candidates[0]! };
      else if (candidates.length > 1) target = UNRESOLVED;
    }
    add("imports", fqn + (m[3] ?? ""), target ?? { type: "package", name: segments.slice(0, Math.min(3, segments.length - 1)).join("."), ecosystem: "jvm" });
  }
}

// ---------- C, C++, Objective-C ----------
function suffixMatch(ctx: Context, spec: string): string | undefined {
  const candidates = (ctx.byName.get(baseOf(spec)) ?? []).filter(p => p === spec || p.endsWith("/" + spec));
  return candidates.length === 1 ? candidates[0] : undefined;
}
function native(path: string, code: string, ctx: Context, add: Add) {
  for (const m of code.matchAll(/^\s*#\s*(?:include|import)\s*([<"])([^>"\n]+)[>"]/gm)) {
    const spec = m[2]!.trim();
    const relative = join(dirOf(path), spec);
    const file = relative !== undefined && ctx.paths.has(relative) ? relative : suffixMatch(ctx, spec);
    // System and third-party headers outside the repository are not counted as unresolved.
    if (file) add("includes", spec, { type: "file", path: file });
    else add("includes", spec, m[1] === '"' ? UNRESOLVED : STANDARD);
  }
}

// ---------- Ruby ----------
function ruby(path: string, code: string, ctx: Context, add: Add) {
  for (const m of code.matchAll(/^\s*(require_relative|require)\s*\(?\s*["']([^"'\n]+)["']/gm)) {
    const spec = m[2]!;
    const withExt = spec.endsWith(".rb") ? spec : `${spec}.rb`;
    if (m[1] === "require_relative") {
      const file = join(dirOf(path), withExt);
      add("imports", spec, file !== undefined && ctx.paths.has(file) ? { type: "file", path: file } : UNRESOLVED);
      continue;
    }
    const file = [`lib/${withExt}`, withExt].find(p => ctx.paths.has(p)) ?? suffixMatch(ctx, `lib/${withExt}`);
    if (file) add("imports", spec, { type: "file", path: file });
    else add("imports", spec, RUBY_STANDARD.has(spec.split("/")[0]!) ? STANDARD : { type: "package", name: spec.split("/")[0]!, ecosystem: "gem" });
  }
}

// ---------- PHP ----------
function php(path: string, code: string, ctx: Context, add: Add) {
  for (const m of code.matchAll(/\b(?:require|include)(?:_once)?\s*\(?\s*(?:__DIR__\s*\.\s*)?["']([^"'\n]+\.php)["']/g)) {
    const file = join(dirOf(path), m[1]!.replace(/^\//, ""));
    add("imports", m[1]!, file !== undefined && ctx.paths.has(file) ? { type: "file", path: file } : UNRESOLVED);
  }
  // Namespaces outside the repository belong to Composer packages that cannot be mapped without installing them.
  for (const m of code.matchAll(/^\s*use\s+(?:function\s+|const\s+)?\\?([\w\\]+)(?:\s+as\s+\w+)?\s*;/gm)) {
    const file = suffixMatch(ctx, m[1]!.replaceAll("\\", "/") + ".php");
    if (file) add("imports", m[1]!, { type: "file", path: file });
  }
}

// ---------- Dart ----------
function dart(path: string, code: string, ctx: Context, add: Add) {
  for (const m of code.matchAll(/^\s*(?:import|export|part)\s+['"]([^'"\n]+)['"]/gm)) {
    const spec = m[1]!;
    if (spec.startsWith("dart:")) { add("imports", spec, STANDARD); continue; }
    const pkg = /^package:([\w]+)\/(.+)$/.exec(spec);
    if (pkg) {
      const dir = ctx.manifests.dartPackages.get(pkg[1]!);
      const file = dir === undefined ? undefined : join(dir, `lib/${pkg[2]}`);
      add("imports", spec, file !== undefined && ctx.paths.has(file) ? { type: "file", path: file }
        : dir === undefined ? { type: "package", name: pkg[1]!, ecosystem: "pub" } : UNRESOLVED);
      continue;
    }
    const file = join(dirOf(path), spec);
    add("imports", spec, file !== undefined && ctx.paths.has(file) ? { type: "file", path: file } : UNRESOLVED);
  }
}
