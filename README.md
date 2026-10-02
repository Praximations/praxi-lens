# Praxi Lens

Praxi's renderer-independent foundation for understanding, representing, querying and explaining complex systems. AI models are one supported system type alongside software, databases, agents, workflows and future extensions.

Lens 0.4 explains software repositories of any size to non-experts: multi-language reference extraction, a plain-language role overlay, semantic-zoom maps, system and part descriptions and a guided tour. Vorylen renders it at `/lens`. This is an early preview. The original prompt is preserved in [docs/lens.md](docs/lens.md). Current state and continuation instructions are in [HANDOFF.md](HANDOFF.md).

```text
praxi/
├── praxi-api/
├── praxi-sdk/
└── praxi-lens/             # independent Git repository
    ├── src/
    │   ├── system-model/  # versioned contracts, evidence, integrity validation
    │   ├── analysis/      # adapter → validated model → diagnostics
    │   ├── adapters/       # manifest, repository AST analysis, GitHub ingestion
    │   ├── interpretation/ # inferred semantic overlays
    │   ├── queries/       # hierarchy, neighbors, paths, search, groups, flows
    │   ├── views/         # renderer-independent ViewSpec generation
    │   ├── explanation/   # evidence-backed declarative scene plans
    │   └── extensions/
    │       ├── software/
    │       ├── ai-models/
    │       ├── agents/
    │       ├── databases/
    │       └── workflows/
    ├── examples/
    ├── tests/
    ├── scripts/
    ├── docs/lens.md
    ├── AGENTS.md
    ├── CLAUDE.md
    ├── HANDOFF.md          # decisions, progress and exact next steps
    └── CHECKPOINT.md       # generated validation + Git/source snapshot
```

## Run locally

Requires Node 22 or later. This package is private and not published to npm.

```sh
npm ci
npm run check
npm run demo
```

The demo generates a SystemModel, overview, API-focused view, dependency view and explanation plan as JSON under `output/`. It does not call an AI model or read a real repository. All examples are fictional and explicitly USER_DEFINED.

```ts
import { analyze, manifestAdapter, generateView, planExplanation } from "@praxi/lens";

const { model } = await analyze(manifestAdapter, manifest);
const overview = generateView(model, { kind: "hierarchy", depth: 1 });
const focused = generateView(model, { kind: "hierarchy", rootId: "api", depth: 1 });
const callers = generateView(model, {
  kind: "neighbors", componentId: "db", direction: "incoming", hops: 3,
});
const explanation = planExplanation(model, { kind: "flow", flowId: "flow:login" });
```

Vorylen installs an exact package artifact under its vendor directory. Clean GitHub/Vercel builds need no sibling checkout or registry credential. Core source stays here; refresh instructions are in the web repository's vendor/README.md.

## GitHub analysis

```ts
import { analyzeGitHubRepository } from "@praxi/lens/github";
const result = await analyzeGitHubRepository("https://github.com/expressjs/express");
```

Options include ref, token, signal, onProgress and budget. The website runs this in a browser worker. Metadata/tree come from GitHub; public source comes from raw.githubusercontent.com at a pinned commit. Private source uses GitHub's authenticated blob API. Credentials go only to api.github.com; redirects are rejected. No source is executed, persisted or sent to AI.

Scale: structure is mapped for up to 50,000 files by default (hard cap 60,000). Truncated GitHub trees are completed one top-level folder at a time. Source reading defaults to 900 files / 9 MB (hard caps 3,000 files / 24 MB, 250 KB per file), chosen by `selectSources`: manifests first, then a round-robin across top-level areas preferring entry points and shallow files, tests and generated code last. A soft deadline (45 s default) returns an honest partial map instead of failing. Coverage, omissions and unresolved references are reported.

`@praxi/lens/repository` accepts an already-collected snapshot. References are extracted as data, after comments (and where relevant strings) are removed: JavaScript/TypeScript (Babel, including Vue/Svelte/Astro script blocks, tsconfig `paths`/`baseUrl`/`extends` and npm workspaces), Python, Go (go.mod modules), Rust (`mod`/`use`, workspace crates), Java/Kotlin/Scala/Groovy, C/C++/Objective-C includes, Ruby, PHP and Dart. Manifests: package.json, requirements*.txt, pyproject.toml, setup.py, go.mod, Cargo.toml, Gemfile, composer.json, pubspec.yaml. Resolution follows each ecosystem's documented lookup order; anything else stays unresolved. Standard-library imports are counted, not drawn. CommonJS require-reference edges describe syntax, not proof of a runtime call. Other languages (C#, Swift, ...) get file structure only. Common generated/secret paths, symlinks and submodules are excluded; code files with secret-like names stay visible as structure but are never read. This is not a complete secret scanner.

## Understanding for non-experts (0.4)

- `interpretSoftwareRoles(model)` adds an INFERRED `role` overlay: every file and outside package belongs to exactly one plain-language role (user interface, command line, server & API, AI & models, core logic, integrations, data & storage, shared helpers, outside packages, tests, docs, examples, tooling, configuration, deployment, media, other). Signals are folder names, file names/types and the outside libraries each file uses; `classifySoftwareComponent` returns the reasons and confidence. Observed components, relationships and IDs are unchanged and repeated calls replace the overlay.
- `generateView(model, { kind: "groups", groupKind: "role" })` is the architecture ("big picture") view: one node per role with description and layer hint, and references between roles with every supporting relationship ID. It is never more certain than the overlay.
- `generateView(model, { kind: "overview", rootId, target: 24, combineKinds: true })` is semantic zoom: the busiest places open first until about `target` parts are visible, single-child folder chains read as one place (`src/main/java`), unconnected files and overflow become bundles with exact `memberIds`, and nodes carry size, context and dominant role.
- `describeSystem(model)` and `describeEntity(model, id)` produce plain-language summaries: what it is, languages, roles and where they live, how parts rely on each other, where to start reading, most-used files, and per part what it relies on, what relies on it, what it provides and why it has its role. Owners' descriptions and README text are quoted as their claims.
- `planTour(model)` is a guided tour: the whole system, each major part with what it relies on, then where to start reading. Role scenes keep INFERRED provenance.
- Validated models are cached by object identity (`validModel`, `indexModel`), so treat them as immutable. On a 30,000-file model, overlays take ~0.3 s and views ~0.05-0.1 s after a one-time ~1 s validation.

## Model and view boundaries

`SystemModel` schema 0.1 holds stable system/component IDs, containment, relationships, explicit ordered flows, evidence, semantic groups and namespaced extension data. Generic kinds can represent interfaces, capabilities, sensors and other concepts without adding a giant type enum. Dedicated runtime/event/metric contracts are future work; this foundation does not implement all concepts from the vision.

`ViewSpec` references one model revision and a bounded selection. It carries nodes, relationships, evidence levels, hidden child counts, optional declared flow order and renderer interaction hints. Labels and source URIs are untrusted content: renderers must escape them and validate links. Layout values are hints; there are no coordinates or library-specific objects.

Structural containment and inferred semantic grouping remain separate. Queries never mutate the input. Paths follow declared relationship direction and are dependency views; only explicit flows produce sequence animation instructions. Scenes preserve uncertainty and evidence. The current explanation planner is a deterministic fallback, not natural-language understanding or adaptive teaching.

Unknown extension namespaces round-trip with diagnostics. Register a versioned schema in `ExtensionRegistry` to validate a new namespace without editing the core. Known extension modules currently validate metadata; they do not ingest live AI weights, databases, or workflow engines.

## Current limits

- All analysis is in memory. Views are capped at 500 entities; overview bundles summarize the rest. Models beyond ~60,000 files are partial.
- Hierarchy views show actual selected relationships; overview and groups views aggregate across levels.
- Roles come from naming conventions and imports, so unusual layouts can be misread; the reasons are always shown. No AI narrative or natural-language questions yet.
- Manifest ingestion validates consistency and preserves declared provenance. It cannot establish that submitted facts are true.
- GitHub analysis and Vorylen web rendering are implemented. Local checkout ingestion, live Praxi interpretation, persistence, runtime observation and native desktop/mobile integration remain unfinished.
- Visibility defaults to private. Public/unlisted flags do not implement authorization or redact evidence.
- Lens does not own rendering (Vorylen), shared information storage (Praxium Core), or scheduling (Vireon).

See HANDOFF.md for next steps and docs/costs.md for operating costs.
# Overview projection (0.3)

`generateView(model, { kind: "overview", rootId: model.system.id, depth: 1 })` selects the visible frontier of containment. Relationships inside hidden descendants are summarized between visible ancestors, grouped by direction and kind. Each overview edge includes `relationshipIds` for its exact supporting model references. Internal references within one collapsed component are omitted. Limits never produce edges with missing endpoints.

Projection does not mutate SystemModel or imply runtime execution. Its provenance is at most DERIVED and never stronger than its supporting claims. `queryModel` returns the underlying relationship IDs; `generateView` produces the projected endpoints. Existing hierarchy, neighbor, path, search and flow behavior is unchanged. Renderers should use the optional edge `relationshipIds` field to open the original evidence.
