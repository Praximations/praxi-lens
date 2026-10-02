# Praxi Lens handoff

Updated 2026-10-02. Read AGENTS.md and CHECKPOINT.md first. Full original vision: docs/lens.md (unchanged). Product names: Vorylen and Vireon.

## Current milestone: 0.4 "understand any software project" (2026-10-02)

User direction (2026-10-02): Lens must let an average person look at any software project, from tiny to enormous ("all of Claude"), and understand what is going on. Software first. Physical/hardware systems are explicitly deferred: do not start them until the user asks.

Work is on branch `claude/lens-program-visualization-d5dodf` in praxi-lens and vorylen-web (pushed; not merged to main, so not deployed to production). praxi-api was not changed.

### Completed behavior (core @praxi/lens 0.4.0)
- Scale/performance: `validModel` caches validation per object (parseSystemModel outputs are pre-registered); `indexModel` builds parent/children/adjacency/leaf/activity maps once; queries and views use Sets/Maps. `withSemanticGroups` validates overlays incrementally. 30k-file model: overlay ~0.3 s, views 0.03-0.1 s after a one-time ~1 s validation (tests/understanding.test.mjs has a 30k scale test).
- Semantic zoom: overview `target` opens the busiest places first (partially, with an overflow bundle, when a place cannot open whole); single-child folder chains collapse (`src/main/java`); 3+ unconnected leaves become a "N other files" bundle; nodes carry size, context, dominant role; bundles carry exact `memberIds`; `combineKinds` merges parallel edge kinds (`kindCounts`). Ranked search (name > path > kind, shallow/active first).
- `groups` query/`architecture` view: one node per overlay group (role) with description/layer; edges keep every supporting relationship ID; provenance never above the overlay (INFERRED).
- Multi-language extraction (src/adapters/repository/languages.ts, manifests.ts): JS/TS via Babel (+Vue/Svelte/Astro scripts, tsconfig paths/baseUrl/extends, npm workspaces resolve to source), Python (relative/absolute/package roots, docstrings ignored), Go (go.mod modules -> folders), Rust (mod/use/crate/super/workspace crates), JVM (FQN -> file suffix, wildcard -> folder), C/C++/ObjC includes, Ruby, PHP, Dart; manifests package.json, requirements, pyproject, setup.py, go.mod, Cargo.toml, Gemfile, composer.json, pubspec.yaml. Comments (and strings where imports are not strings) are stripped first. Standard-library imports are counted (`standardLibraryImports`), not drawn. JS resolution now follows TypeScript/bundler order (exact, extensions, index) instead of rejecting ambiguity. Language tables live in src/extensions/software/languages.ts (no Babel in the main entry).
- GitHub reader: defaults 50k structure files, 900 source files / 9 MB, 45 s soft read deadline (partial map + diagnostic), 120 s hard timeout, 12 parallel raw reads (6 for private API blobs); hard caps 60k / 3,000 / 24 MB / 250 KB per file. `selectSources` = manifests, then round-robin over top-level areas (entry points, shallow first), tests/generated last. Truncated trees are re-listed per top-level folder (max 40 extra API calls). Owners' description/topics + README opening paragraph (max 400 chars, code/markup/badges stripped) recorded with their own evidence. Code files with secret-like names (credentials.ts) stay as structure but are never read; .env/keys/secret data files remain excluded.
- Plain-language understanding: `interpretSoftwareRoles` (INFERRED role overlay, one role per leaf, reasons via `classifySoftwareComponent`), `describeSystem`, `describeEntity`, `describeConnection`, `planTour`, vocabulary helpers (`kindLabel`, `relationshipVerb`, `lowerName`, ...).
- Measured on real repos (same commits as before): vorylen-web 40 -> 575/575 source files read, 94 -> 2,048 references, 1 unresolved; praxi-api 240 -> 1,936 references (unresolved drop from 27 to 3 after the credentials.ts fix; remaining 3 import a sibling checkout).

### Completed behavior (Vorylen web, branch only)
Big picture tab (roles in lanes: What people use -> Handles requests -> Main logic -> Data & services -> Outside packages, supporting files row), Map with Simple/Normal/Detailed zoom (12/24/48), role colors + legend filter, "What is this?" summary, plain-language inspectors (part, role, bundle, connection) with "why" reasons, guided tour (planTour), deeper-scan option, stacked phone layout, larger JSON import limits (40 MB / 80k parts). Details in vorylen-web LENS_HANDOFF.md.

### Decisions
- Roles are deterministic heuristics (names, file types, imported libraries), stored as INFERRED semantic groups with reasons/confidence; observed facts untouched. No AI provider calls (AGENTS.md: no silent paid providers; provider execution belongs behind Praxi API).
- Role colors: 7 validated categorical slots (dataviz palette, light+dark validated); outside packages/supporting roles neutral; names always shown so color is never the only cue. Parts under 35% dominant share render as "Mixed roles".
- Lane layouts hide within-lane and supporting-file edges until a part is pointed at (count shown); evidence is unchanged.
- README summary is author documentation (bounded), quoted as the owners' claim; no source code enters the model.

### Validation (this milestone)
Core `npm run check`: build + 38 tests pass (15 new: languages, understanding, adapter scale/deadline/truncation/credential paths; the previous 23 unchanged). Web: `tsc --noEmit`, ESLint on Lens files, `next build --webpack` all pass. Playwright (local dev server with placeholder Supabase env, browser GitHub traffic relayed through the sandbox): live in-browser analysis of Praximations/praxi-api (481/481 sources, 28 s) and praxi-lens (2 s), guided tour, Map, inspector, 390 px phone layout (no horizontal overflow), 28k-file synthetic import (1.4-1.7 s to first view, ~0.2 s per interaction). Only console error: pre-existing missing /praximations/Vorylen-Logo.png.
Not validated: production deployment, private-repo token flow against real GitHub, other-org repositories (sandbox proxy only allowed Praximations repos), real 50k+ file repositories over the network.

### Next concrete actions
1. User review of the branch; if approved, merge both branches to main (web main deploys praximations-web on Vercel), then verify https://www.praximations.com/lens on a large public repo.
2. Move query/view generation into the worker (or a second worker) so 50k+ file models never validate on the main thread.
3. Optional AI narrative through Praxi API (provider behind API boundary, user-approved cost): use describeSystem/describeEntity facts + evidence IDs as grounding; keep it labeled INFERRED.
4. Function-level drill-down (exports already recorded) and declared flows from route handlers.
5. Hardware/physical systems only when the user asks.

## Previous milestone (0.3, 2026-09-30)


The user asked for a simpler, more powerful experience inspired by GitDiagram and similar tools, integrated into Praxi Dev. Core 0.3.0 and the diagram-first web redesign are implemented, pushed and live at https://www.praximations.com/lens and https://www.praximations.com/dev/lens.

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
Final web production build, focused ESLint and TypeScript check all passed. Core code was unchanged after its 23-test run; only handoff documentation changed afterward.
Chrome local checks: sample folder drill-down, summarized-edge original reference inspection, directed path Web client -> Database (4 nodes/3 edges), real Praximations/praxi-lens analysis (38 files/26 source files at 6911fc5), search by full path, used-by query, 390px responsive layout, and Dev shell rendering via development-only harness.
Local /dev/lens redirects unauthenticated users to login. Production /dev/lens was verified in the existing signed-in session: real Dev project selector, internal Project tabs with Praxi Lens, and the embedded analyzer all loaded in engine mode. That project had no linked repo, so repository/branch prefilling is implemented/typechecked but not live-tested. Private tokens have mocked transport tests, not live credential tests. Browser viewport override reset after checks.
Development harness /dev-preview?view=lens follows the existing production Vercel 404 guard.

## Final publication record

- Core implementation 70143f29248a6259fc23bbd4e5914f151385eab2 pushed to main; web implementation 8a9726692b610c933f832d1c8103027d19f299f7 pushed to main. Both worktrees were clean after these implementation commits.
- Vercel production deployment dpl_4mjFyKtXngum9hAxZTP7eYtd5jpT is READY, built from web 8a97266. URL: praximations-opq6xq893-ari-4150s-projects.vercel.app, aliased to www.praximations.com.
- The redesigned public production page analyzed Praximations/praxi-lens at 70143f2: 39 files, 27 source files read, 17 overview nodes and 7 summarized connections. Production /dev/lens rendered correctly in the signed-in Dev shell.
- This final record supersedes the pre-publish status in web LENS_HANDOFF.md. It lives in core to avoid a documentation-only web redeployment. This handoff-only commit does not change the tested package.
- An initial push did not execute because automatic approval review hit a usage limit. The user said continue; subsequent authorized pushes succeeded. No unresolved publishing blocker remains.

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

### Next-agent prompt (2026-10-02)
"Read AGENTS.md, HANDOFF.md (0.4 milestone) and CHECKPOINT.md in praxi-lens, then vorylen-web LENS_HANDOFF.md. Both repos have branch claude/lens-program-visualization-d5dodf with core 0.4.0 and the Big picture UI; confirm with git whether it was merged. Run `npm ci && npm run check` in praxi-lens (expect 38 passing tests) and `npm ci && npx tsc --noEmit` in vorylen-web. Keep the vendored tgz and lockfile in sync (vendor/README.md). Continue with HANDOFF 'Next concrete actions' in order; do not start hardware/physical systems unless the user asks."
Cloud sessions: Node 22 is on PATH; GitHub access goes through a proxy that only allows this session's repositories; Playwright must use executablePath /opt/pw-browsers/chromium; the web dev server needs placeholder NEXT_PUBLIC_SUPABASE_URL/ANON_KEY values (never commit them).

