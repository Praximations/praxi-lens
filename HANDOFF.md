# Praxi Lens handoff

Updated 2026-09-30. Read AGENTS.md and CHECKPOINT.md first. Full original vision: docs/lens.md (unchanged). Product names: Vorylen and Vireon.

## In progress (2026-10-02, branch claude/lens-program-visualization-d5dodf)

User goal: Lens must make any software project, from tiny to enormous (e.g. "all of Claude"), visually understandable to an average person. Software first; physical/hardware systems explicitly deferred.
Done so far on this branch (core 0.4.0, unpublished): cached ModelIndex + Set/Map queries; semantic-zoom overview (`target` auto-depth, single-child folder chains collapsed, quiet files and overflow bundled with exact memberIds, node size/context/role); `groups` architecture projection; ranked search; multi-language references (Python, Go, Rust, Java/Kotlin/Scala, C/C++/ObjC, Ruby, PHP, Dart, Vue/Svelte/Astro) + manifests (requirements/pyproject/go.mod/Cargo/Gemfile/composer/pubspec) + tsconfig paths/extends + npm workspaces; standard-library imports counted, not drawn; GitHub reader budget 900 files/9 MB (hard caps 3,000/24 MB, 60k structure files), balanced area sampling, soft read deadline, truncated-tree recovery per top-level folder, repo description/topics/README summary. Credential-named code files stay as structure but are never read.
Measured: vorylen-web 40 -> 575/575 source files, 94 -> 2,048 references; praxi-api 240 -> 1,936 references.
Next: deterministic plain-language roles overlay + describe/tour APIs, then web Big-picture UI. See bottom of this file when complete.

## Current milestone

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

