# Praxi Lens handoff

Updated 2026-09-29. Read AGENTS.md and CHECKPOINT.md. The original 52-section prompt remains byte-for-byte in docs/lens.md; current product names are Vorylen and Vireon.

## Current milestone

User asked for Vorylen rendering and real GitHub analysis through the website today, with low running costs. User supplied Praximations/praxi-lens as the remote. SSH is unavailable on this machine, so equivalent HTTPS origin is configured.

Core 0.2 and web/GitHub preview are implemented, pushed and live at https://www.praximations.com/lens. Lens implementation commit: d98c037. Web implementation commit: 2c5770c. Both use main. Subsequent handoff-only commits do not change the tested implementation.

## Implemented

- Independent @praxi/lens TypeScript ESM package; experimental schema 0.1. SystemModel, ViewSpec, integrity checks, provenance, semantic overlays, hierarchy/neighbor/path/search/group/flow queries and deterministic explanation plans.
- Software, ai-models, agents, databases, workflows metadata validators. Unknown extensions survive.
- adapters/repository: snapshots to file/folder models, Babel AST module references, package dependencies. Stable IDs, unresolved-import reports, no code execution. Referenced packages are grouped under group:packages.
- adapters/github: owner/repo validation, commit pinning, GitHub tree and bounded source reads. Optional read-only token goes only to api.github.com; redirects rejected. Public source uses raw.githubusercontent.com at the pinned SHA; private source uses authenticated blob API.
- Limits: 1,200 files, 40 source files, 100 KB/file, 1.5 MB total source, four concurrent source fetches, 90-second network deadline. Partial coverage/errors are visible.
- Vorylen route app/lens/page.tsx; reusable UI/worker in app/components/lens. No Lens backend/API/new Supabase tables. Analysis and credentials remain in browser memory.
- UI: repo/ref/token inputs, cancel, real Express example, teaching example, model JSON import/export, focus, selection, depth, dependencies/direction, search, zoom/scroll, breadcrumbs/back, evidence links, guided inspection and coverage. Links in website Products and Dev navigation.
- Vorylen installs vendor/praxi-lens-0.2.0.tgz pinned in its lockfile, so clean builds need no private registry credential or sibling directory. Refresh instructions: web vendor/README.md.

## Validation

- Lens npm run check: build and 21 tests passed, including AST syntax, unsafe paths, root-escape regression, URL allowlisting, mocked public/private transport, token confinement, rate-limit errors, graph integrity and interpretation/view behavior.
- Live Node adapter on expressjs/express: 213 files, 40 source files, 165 references, commit 7ef98448f8b38099ab1ded55e458538ad47a51e7. Reported 40/142 source coverage and 32 unresolved imports.
- Web production build, final typecheck and focused ESLint passed.
- Chrome UI: teaching-example focus/semantic zoom, dependency view, search for lib/express.js, evidence links and real Express analysis through the worker passed. Desktop screenshot reviewed. Real private credentials and every mobile/UI control are not yet browser-tested.
- Vercel deployment dpl_BZ2cod4oboi8cSh7WbnQG3wB1v58 is READY, built from web commit 2c5770c. Production /lens returned HTTP 200 with the GitHub CSP permissions.
- On the production website, Praximations/praxi-lens analyzed successfully: 38 files, 26/26 eligible source files read, package-reference grouping visible. Its GitHub repository is public, so no token is needed. The live tab was left open with this result.

## Publishing state

Completed for this milestone. Core and web source are pushed to their approved repositories. Existing Vercel project praximations-web deploys the web repository automatically. No separate Lens Vercel service is needed. Web LENS_HANDOFF links back here; this is the authoritative final verification record.

## Next product work and limits

Improve language coverage, aliases, graph aggregation, evidence locations and then optional Praxi semantic grouping/question-to-query. Do not add paid model calls silently. No local-checkout adapter, incremental analysis, runtime/call-graph proof, database parsing, comparison, shared persistence or native-client integration yet.

JS/TS and package metadata are parsed; other files have structure only. Aliases/ambiguous relative paths are unresolved. require-reference is syntactic and may name a shadowed function. Secret-path exclusions are not a general secret scanner. View layouts are deterministic cards/graphs, not a full layout/performance/accessibility certification.

No public model sharing. Imported evidence labels are assertions, not independent verification. Export downloads paths/evidence references but not raw source or tokens. Private analysis needs the user's fine-grained Contents-read token; GitHub App/OAuth integration remains future work.

Existing web npm audit has 8 advisories, including critical Next.js 16.2.10 and pre-existing high dependency findings. Lens's dependency audit is clean. Schedule a tested framework/security update; npm reports Next 16.3.7 as its fix. Do not claim web audit is clean.

## Cost and continuity

No AI calls or per-analysis Vercel processing. Normal website hosting/session middleware and GitHub limits apply. Vercel Hobby is personal/non-commercial only. No plans/services were purchased. See docs/costs.md.

At every milestone update HANDOFF and run npm run check; if interrupted, npm run checkpoint records validation as not rerun. CHECKPOINT records capture-time Git state and a source digest; its HEAD can precede the containing commit.

Resume: Read this file, AGENTS.md, CHECKPOINT.md and web LENS_HANDOFF.md; verify actual Git/deployment status, finish publishing if pending, then continue the next product work above. Do not rebuild the existing foundation or present unfinished features as available.
