# Praxi Lens handoff

## Read this first

This file is the durable continuation point for Codex, Claude Code, or another developer. Do not depend on the original chat. Read AGENTS.md, this file, and CHECKPOINT.md before editing. The full user prompt is preserved byte-for-byte at docs/lens.md; the original workspace lens.md remains untouched.

User objective: create a separate praxi/praxi-lens repository beside praxi-api and praxi-sdk. Lens is a universal system-understanding capability, not an AI-model-only visualizer. Core model, queries, analysis, semantic interpretation, explanation planning and adapters live here. Actual rendering lives in Vorylen clients. Preserve progress early because the user may switch AI accounts/tools with little notice.

## Current milestone

2026-09-29: first working core foundation. Phase 0 is **partially complete**: hand-authored multi-system models and renderer-independent outputs exist; the interactive viewer is not built. No production service or existing sibling repository was changed for Lens.

Implemented:

- TypeScript ESM package @praxi/lens with runtime Zod validation and declaration output.
- Experimental SystemModel 0.1: stable IDs, evidence levels, version references, physical containment, relationships, explicit flows, inferred semantic overlays, namespaced extensions.
- Graph validation for duplicate IDs, dangling references, missing evidence, unsupported verified/derived claims, containment cycles and disconnected flows.
- Manifest adapter and analysis pipeline. Unknown extensions survive with diagnostics.
- Metadata validators under the actual software, ai-models, agents, databases and workflows directories. These are not live system analyzers.
- Hierarchy/zoom, directional dependency traversal, shortest directed paths, search, semantic-group selection and explicit-flow queries. Output cap and truncation reporting.
- ViewSpec generation with stable IDs, evidence, layout hints, hidden-child counts and focus/expand/collapse interaction hints. No frontend dependency.
- Versioned inferred-group application that leaves source containment unchanged. No intelligence-provider call yet.
- Deterministic scene planning with evidence, uncertainty and user-controlled pacing. Explicit flows can request motion; dependency graphs cannot pretend to be execution traces.
- Fictional examples for software, AI architecture, databases, agents/workflows and an unrecognized robot extension.
- Local validation/checkpoint tooling and a GitHub Actions workflow ready for a future remote.

## Validation and reproducibility

Run from this repository root:

```sh
npm ci
npm run check
npm run demo
```

`npm run check` is the canonical build + behavioral test command and regenerates CHECKPOINT.md, including failure results and a source fingerprint. Tests cover model integrity, multiple system types, provenance, cyclic dependency traversal, direction/filter/limit handling, zoom/focus, disconnected flows, inference separation, serialization and conservative scene certainty. See CHECKPOINT.md for the last actual result; do not infer success from this document.

`npm run demo` writes five ignored JSON files to output/. The generated files are local examples, not published artifacts. No credentials are required. Dependencies are pinned and package-lock.json is committed.

Initial milestone validation: TypeScript build and all 14 behavioral tests passed on Node 24.18.0; the demo produced all five JSON artifacts. The declared minimum Node 22 is configured in CI but was not separately executed locally. No browser/UI validation applies because no renderer was added.

## Decisions to preserve

1. Keep the core library independent of Praxi providers, Vorylen frameworks, rendering libraries, Supabase and Node filesystem access. Adapters and app boundaries can connect them later.
2. Current schema is provisional 0.1. Test additional system types before stabilizing a public wire format.
3. Keep relationships and behavior distinct. Import/dependency edges alone never prove calls or runtime order.
4. Keep evidence quality visible. USER_DEFINED examples are not VERIFIED architecture. Manifest validation proves consistency, not truth.
5. Semantic groups are overlays; do not rewrite observed parents to match AI inference.
6. Preserve the original prompt's old product names as source text. Current products are Vorylen (formerly Praximation/Praximations) and Vireon (formerly Praxos).
7. The generated checkpoint records capture-time Git state. Its HEAD may precede the commit containing that checkpoint; that is intentional. The source hash, commands and results are the validation evidence.

## Exact next task

Finish phase 0 in the existing Vorylen web project, keeping its reusable renderer outside this core repo. First read that repository's AGENTS.md and inspect its current application structure and dependency versions. Read docs/lens.md sections 5, 6, 12, 22, 36-38 and 46-49.

Suggested implementation sequence:

1. Add a development/demo Lens surface in Vorylen web using the fictional software fixture and ViewSpec contract. Integrate this package reproducibly (workspace-independent package artifact or an approved Git remote); avoid introducing a dependency that only resolves on this computer. The remote is currently missing.
2. Prove overview, selection, focus, expand/collapse, hierarchy/dependency switching, breadcrumbs/back navigation and visible evidence labels. Keep state keyed by stable model IDs.
3. Show evidence details on selection, distinguish inferred/user-defined/verified claims, and show truncation/incomplete-analysis notices. No public sharing yet.
4. Support the declarative scene data with pause/back/next only after the core exploration works; no video generation and no model call just to zoom.
5. Test the renderer and document acceptance results here. Only then start phase 1 repository fact extraction (safe local/Git ingestion, ignore rules, secret exclusion, source revisions, deterministic language-aware parsers).

If the user wants more core work before UI, implement a bounded local repository adapter as a clearly identified phase-1 task; do not claim it is already present. Keep it on a separate Node-only import path and do not execute repository code during analysis.

## Explicitly unfinished

- Vorylen renderer and package integration; desktop/mobile rendering.
- Local/Git/GitHub extraction, incremental analysis and stable source-to-identity mapping.
- Praxi-backed grouping, natural-language View Query translation and semantic search.
- Rich adaptive explanations, timeline/state/runtime views, comparisons and history storage.
- Praxium persistence and Vireon refresh/scheduling connections.
- Authentication, authorization, evidence redaction and sharing/publishing boundaries.
- Large-system indexing, graph aggregation and performance work.
- Published adapter SDK, npm release, GitHub remote and deployment.

No service is deployed for Lens. It is a library and does not need its own Vercel project at this stage. No GitHub URL was provided for praxi-lens; do not guess or push it to praxi-api or praxi-sdk. A different profile on this computer can open this folder now. A different computer needs a Git remote or a copy of the entire repo.

## Resume prompt

> Work in praxi/praxi-lens. Read AGENTS.md, HANDOFF.md and CHECKPOINT.md first. This repo contains the initial renderer-independent Lens core and fictional examples, not a complete app. Run npm ci and npm run check. Continue the next milestone described in HANDOFF.md, preserving the separation between Lens core and Vorylen rendering. Update HANDOFF.md and regenerate CHECKPOINT.md at each meaningful milestone and before ending. Ask for the praxi-lens remote only when remote sharing is needed. Do not redo completed foundation work or claim deferred features exist.
