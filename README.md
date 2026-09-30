# Praxi Lens

Praxi's renderer-independent foundation for understanding, representing, querying and explaining complex systems. AI models are one supported system type alongside software, databases, agents, workflows and future extensions.

Lens 0.2 adds bounded GitHub repository analysis, rendered by Vorylen at `/lens`. This is an early preview. The original prompt is preserved in [docs/lens.md](docs/lens.md). Current state and continuation instructions are in [HANDOFF.md](HANDOFF.md).

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

Options include ref, token, signal and onProgress. The website runs this in a browser worker. Metadata/tree come from GitHub; public source comes from raw.githubusercontent.com at a pinned commit. Private source uses GitHub's authenticated blob API. Credentials go only to api.github.com; redirects are rejected. No source is executed, persisted or sent to AI. Limits: 1,200 files, 40 JS/TS/package source files, 100 KB/file and 1.5 MB source total. Coverage and unresolved references are explicit.

`@praxi/lens/repository` accepts an already-collected snapshot. Babel parses import syntax separately from comments/strings. Relative paths use conservative resolution; aliases/ambiguous paths remain unresolved. CommonJS require-reference edges describe syntax, not proof of an unshadowed require or runtime call. Other languages get file structure only. Common generated/secret paths, symlinks and submodules are excluded; this is not a complete secret scanner.

## Model and view boundaries

`SystemModel` schema 0.1 holds stable system/component IDs, containment, relationships, explicit ordered flows, evidence, semantic groups and namespaced extension data. Generic kinds can represent interfaces, capabilities, sensors and other concepts without adding a giant type enum. Dedicated runtime/event/metric contracts are future work; this foundation does not implement all concepts from the vision.

`ViewSpec` references one model revision and a bounded selection. It carries nodes, relationships, evidence levels, hidden child counts, optional declared flow order and renderer interaction hints. Labels and source URIs are untrusted content: renderers must escape them and validate links. Layout values are hints; there are no coordinates or library-specific objects.

Structural containment and inferred semantic grouping remain separate. Queries never mutate the input. Paths follow declared relationship direction and are dependency views; only explicit flows produce sequence animation instructions. Scenes preserve uncertainty and evidence. The current explanation planner is a deterministic fallback, not natural-language understanding or adaptive teaching.

Unknown extension namespaces round-trip with diagnostics. Register a versioned schema in `ExtensionRegistry` to validate a new namespace without editing the core. Known extension modules currently validate metadata; they do not ingest live AI weights, databases, or workflow engines.

## Current limits

- All analysis is in memory. Output is capped at 500 entities, but internal traversal is not a large-system performance guarantee.
- Hierarchy views show actual selected relationships; cross-level aggregation is not implemented.
- Manifest ingestion validates consistency and preserves declared provenance. It cannot establish that submitted facts are true.
- GitHub analysis and Vorylen web rendering are implemented. Local checkout ingestion, live Praxi interpretation, persistence, runtime observation and native desktop/mobile integration remain unfinished.
- Visibility defaults to private. Public/unlisted flags do not implement authorization or redact evidence.
- Lens does not own rendering (Vorylen), shared information storage (Praxium Core), or scheduling (Vireon).

See HANDOFF.md for next steps and docs/costs.md for operating costs.
