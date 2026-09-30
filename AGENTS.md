# Praxi Lens working instructions

Read `HANDOFF.md` and `CHECKPOINT.md` first. Read `docs/lens.md` for the full user specification when the next task needs it. `README.md` describes the current implementation.

## Ownership

Lens owns SystemModel, ViewSpec, deterministic analysis, queries, semantic interpretation, explanation planning, adapters and system extensions. It understands arbitrary systems; AI models are one type. Keep UI renderers in Vorylen web/desktop/app. Keep shared persistence in Praxium Core, scheduling in Vireon, and intelligence provider execution behind Praxi API boundaries. Historical names in the original prompt map to Vorylen and Vireon.

Do not make the core depend on React, Next.js, a visualization library, an AI provider, Supabase, or a sibling checkout. All source files under src must remain usable without Node filesystem APIs. Node-only tooling belongs under scripts or a separate adapter entry point when implemented.

## Commands

```sh
npm ci
npm run check
npm run demo
```

`check` builds, runs the behavioral test suite and writes `CHECKPOINT.md`, including failures and a source fingerprint. `demo` writes ignored JSON artifacts under output. Neither command needs credentials or network access after dependencies are installed.

## Durable handoff protocol

Do not wait for a token limit warning; agents cannot reliably predict the remaining usage budget.

1. At each meaningful milestone, update HANDOFF.md: completed behavior, changed files, decisions, validation, unfinished work, and the next concrete action.
2. Run `npm run check` after implementation changes. It records actual validation results. If interrupted before checking, use `npm run checkpoint` to record state explicitly as not rerun.
3. Before ending a session, leave a precise next-agent prompt in HANDOFF.md. Identify any uncommitted changes, missing remotes, or blockers. Never mark planned work as finished.
4. Keep handoff/checkpoint files in version control with the implementation. Make small local commits at completed milestones. Push only to a user-provided/approved remote. Never commit credentials, raw private repositories or generated analysis output.
5. A generated checkpoint records the HEAD/worktree at capture time; it is not a promise that later changes were checked. Compare its source digest or rerun checks when uncertain.

## Contracts and limits

Schema 0.1 is experimental. Validate external input with parseSystemModel/analyze; raw schema validation alone does not check graph integrity. Preserve IDs and provenance. Keep inferred semantic groups separate from observed containment. A dependency path is not a runtime execution trace. Manifests contain assertions, not automatically verified facts.

Visibility is metadata, not access control or redaction. Do not publish models without authorization and evidence redaction. GitHub ingestion now accepts an optional read-only token; keep it in memory, send it only to api.github.com, reject redirects, and never include it or raw source in model output. The website processes models in the user's browser without shared storage.

Follow the prompt's phase order: prove the renderer with hand-authored data, then repository extraction, then Praxi interpretation and natural-language queries. Do not invent dozens of future packages or claim current metadata validators are full system analyzers.
