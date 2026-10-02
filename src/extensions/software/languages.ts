/** Software-domain vocabulary shared by ingestion and explanation. Pure data; no parser dependencies. */
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

