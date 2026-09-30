# Praxi Lens handoff

Updated 2026-09-30. Read AGENTS.md and CHECKPOINT.md first. Full original vision: docs/lens.md (unchanged). Product names: Vorylen and Vireon.

## Current milestone

The user asked for a simpler, more powerful experience inspired by GitDiagram and similar tools, integrated into Praxi Dev. Core 0.3.0 and the diagram-first web redesign are implemented. Publishing this milestone is pending; the previous 0.2 implementation is already live at https://www.praximations.com/lens.

## Implementation and boundaries

- Independent renderer-free TypeScript ESM package @praxi/lens. Experimental SystemModel/ViewSpec schema 0.1, integrity checks, provenance, semantic overlays, deterministic explanation plans.
- Core 0.3 adds the overview query: a containment frontier with descendant relationships projected onto visible ancestors, grouped by direction/kind. View edges preserve exact relationshipIds; query results use underlying IDs. Projection never upgrades evidence or fabricates runtime behavior. Source: src/queries/overview.ts, queries/query.ts, views/generate.ts, views/spec.ts.
- Existing hierarchy/neighbor/path/search/group/flow queries, adapters, software/ai-models/agents/databases/workflows metadata validators remain. Unknown extensions survive.
- GitHub adapter pins a commit, parses bounded JS/TS source with Babel and package dependencies without executing code. Limits: 1,200 files, 40 source files, 100 KB/file, 1.5 MB total source, four concurrent reads, 90-second network deadline. Coverage and unresolved aliases/imports are reported.
- Public source is fetched from raw.githubusercontent.com; private source/token stays on api.github.com. Redirects rejected. No tokens/raw source in model output.
- UI is in sibling Vorylen web, app/components/lens. Shared LensExplorer + worker + GraphCanvas renderer. Public /lens has one repository input; optional branch/token/import controls. Map opens after analysis or explicit example.
- New graph: folder-level connections with evidence drawer, drag/keyboard pan, zoom, fit, expanded view, selection, search, focus/breadcrumbs/back, depends-on/used-by, path tracing, flows, optional file list/walkthrough/coverage, JSON import/export.
- New authenticated /dev/lens is app/(dev)/dev/lens/page.tsx + components/devbranch/LensPage.tsx. Uses existing Dev shell/guards. Real selected project repository and branch prefill the analyzer; key changes terminate/reset the old worker when switching projects. Preview project repo is deliberately not treated as real. Standalone analysis works without a project.
- Dev nav now links internally to /dev/lens; Repository page has Open Lens action. Existing checkpoint Architecture page remains separate.
- GitHub account/OAuth tokens are not automatically shared with browser Lens. Private repos still require a user-provided read-only token in Options.
- Web vendors praxi-lens-0.3.0.tgz plus lockfile: no sibling dependency, registry setup, backend, or database migrations. Source stays in Lens; coordinates/layout stay in Vorylen.
- Browser memory only. Models are not persisted across navigation/reloads. Export explicitly downloads the model. No paid AI calls or new services.

## Validation

Core npm run check: build + 23 tests passed (includes overview evidence/limits/direction/grouping, existing graph integrity, AST extraction, public/private token confinement, unsafe URLs and paths, rate-limit handling).
Web production build + focused ESLint passed before final UI refinements; final checks and deployment status are recorded in web LENS_HANDOFF.md.
Chrome local checks: sample folder drill-down, summarized-edge original reference inspection, directed path Web client -> Database (4 nodes/3 edges), real Praximations/praxi-lens analysis (38 files/26 source files at 6911fc5), search by full path, used-by query, 390px responsive layout, and Dev shell rendering via development-only harness.
Real /dev/lens redirects unauthenticated users to login. Authenticated project/branch prefilling is implemented/typechecked but has not been exercised with a live signed-in project. Private tokens have mocked transport tests, not live credential tests. Browser viewport override reset after checks.
Development harness /dev-preview?view=lens follows the existing production Vercel 404 guard.

## Limits / next work

This release provides structural maps and static JS/TS references. No semantic business architecture, natural-language query/AI narrative, runtime call-graph proof, local checkout ingestion, incremental analysis, shared persistence, comparisons, or native clients yet. Layout is bounded/custom; very large/dense cyclic graphs need further layout work. Unconnected files remain visible; zoom/search/focus reduce density. Secret-path exclusions are not a full secret scanner. Import evidence labels are assertions.
Existing web audit has 8 pre-existing advisories including critical Next 16.2.10 (reported fix 16.3.7); schedule a tested upgrade. Lens core audit was clean in the previous milestone. No dependency audit rerun for this UI milestone.

## Continuation

Read web LENS_HANDOFF.md for final publish/validation state. Finish any pending checks and push only approved origins:
- https://github.com/Praximations/praxi-lens.git
- https://github.com/Praximations/vorylen-web.git
Git uses HTTPS/GCM; SSH public-key auth was unavailable. Vorylen Git pushes deploy existing Vercel project praximations-web. No separate Lens service.
Node installed at C:/Users/ariwi/AppData/Local/nvm/v24.18.0; prepend it to PATH when npm is missing. On the current Windows sandbox this runtime needs an approved escalated exec.
At every milestone update HANDOFF and run npm run check after core code changes. CHECKPOINT captures tested source digest, not a deployment promise. Do not rebuild the implemented foundation.

