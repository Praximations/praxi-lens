# Lens preview operating costs

Checked 2026-09-29. Lens 0.2 makes no LLM/image/video calls, stores no source in Supabase, and does no per-analysis Vercel function work. Parsing and view generation run in a browser worker. There are no AI token charges for this implementation.

Normal hosting still consumes bandwidth/static requests and the existing site's session middleware. Local use needs no paid Lens service. This is not a guarantee of zero hosting charges at arbitrary traffic levels.

Vercel Hobby includes free usage within limits and is for personal, non-commercial use. Commercial deployment requires an appropriate plan. No plan upgrades or paid services were enabled. See [Vercel Hobby](https://vercel.com/docs/plans/hobby) and [pricing](https://vercel.com/pricing).

GitHub public REST access is normally limited to 60 requests/hour per originating IP; authenticated users normally have 5,000/hour, subject to other limits. A public analysis uses three REST calls plus bounded raw-file downloads; a private analysis uses up to 43 REST calls at the current limit. Access/rate errors are reported. See [GitHub rate limits](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api).

Each analysis is limited to 1,200 files, 40 eligible source files, 100 KB/file, 1.5 MB total source, four concurrent source fetches and a 90-second network deadline. Repeated analysis fetches again; persistent caching is not implemented. Navigation after analysis is local and makes no GitHub or AI calls. Future optional Praxi semantic interpretation will have provider costs; it is not enabled now.
