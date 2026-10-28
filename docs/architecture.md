# Architecture notes

How the pieces of this site fit together. The README covers running it.

## Design system

`src/styles/global.css` is the single source of truth. Every semantic color is a runtime custom property, so the theme toggle repaints the whole system by flipping one `data-theme` attribute on `<html>` — no duplicate stylesheet, no flash on load (the value is applied by an inline script before first paint). Tailwind's `@theme inline` block maps those properties onto utility classes, so `bg-surface` and `text-dim` resolve to whichever theme is active.

## URLs

The site is published at the apex: **https://noahweidig.com**, so root-relative URLs (`/projects/`) are written by hand and used as they are. URLs inside a content file are written **relative** to the page (`../../media/…`).

Section routes keep their paths. Three pages Quarto rendered as `<name>.html` are directory routes now — `/contact/`, `/cv/`, `/privacy/` — with a redirect stub generated at each old path by `src/pages/[page].html.ts`. The feed is served at both `/rss.xml` and its old address, `/blog/index.xml`; a meta-refresh stub is no use to a feed reader, so `src/pages/blog/index.xml.ts` re-exports the same route.

`public/CNAME` carries `noahweidig.com`, which claims the domain's **root** for this repo. GitHub Pages needs the file in the published output on every deploy, so it is committed rather than set in the repo's Pages settings alone.

## Search

[Pagefind](https://pagefind.app) indexes the built site as a post-build step and the dialog (⌘K, or `/`) loads it on first use. The index only covers `<main>`; the header, footer and search dialog itself are marked `data-pagefind-ignore`.

## Publications

Publications under `src/content/publications/` are regenerated from Zotero every Monday by the weekly refresh, `.github/workflows/bot.yml` (do not edit by hand). That workflow pushes with `GITHUB_TOKEN`, which cannot fire a `push` event, so it calls `publish.yml` directly (`workflow_call`) once it has committed — the deploy runs inside the sync's own run and fails it if it fails, rather than depending on a trigger that can be silently disabled. Every push to `main` rebuilds and publishes through the same workflow.

Public PDF attachments in the Zotero library are downloaded to `public/publications/<slug>/<slug>.pdf` and surfaced as a **View PDF** button on the publication page and in the publications listing; the BibTeX record lands beside it as `cite.bib`.

Zotero exports one record per _appearance_, so a talk given at four venues arrives as four near-identical items. The sync marks the most recent of each cluster `pub-listed: "yes"` and hangs the venue run off it, so the index shows one row per work while every appearance keeps its own page.

Dimensions and Altmetric attention stats are fetched in the same weekly refresh (`node scripts/sync/citation-stats.js`) into `src/data/citation-stats.json` (do not edit by hand), rather than by the vendors' own client-side badge widgets. Both vendors' documented data APIs are gated behind a registration process now; the script instead calls the same unofficial endpoints those widgets themselves use, so a lookup is best-effort and keeps the last successful value on a bad day. `CitationRow.astro` and `publications/[...slug].astro` render the cached numbers as plain links to the Dimensions/Altmetric detail pages, with a tooltip for the extra stats — no vendor JS ships to the page.

## Project screenshots

The card art for each project (`src/assets/albums/projects/<slug>.webp`) is captured from the project's own live site by `scripts/generate/project-shots.mjs`, in the same weekly refresh (`.github/workflows/bot.yml`), so a tool that changes does not keep showing the picture it had the day it shipped.

The URL comes from the first `http(s)` link in the entry's frontmatter, so a new project needs no edit to the script. Shots are 1600×1000 in dark mode, framed from the top — the only geometry the site asks for, since `ProjectCard` and `ResearchAreas` both crop `aspect-16/10 object-cover object-top`. A site that fails to load leaves its committed image alone and warns; only a run where every capture fails fails the job. `roads` and `wuirisk` are skipped in the script (a third-party catalog page and an Earth Engine app) and keep hand-made images.

The same run also refreshes `public/media/noahweidigcom.webp`, the demo image in this README's own header — a 2732×2048 shot of the live homepage at `noahweidig.com` — so it doesn't keep showing a stale design either. Pass `readme` to `npm run shots` to refresh just that one.

## The About map

`/about` ends with a static SVG map of central Florida centred on Orlando (`src/components/OrlandoMap.astro`). No JS, no tiles; the land is Natural Earth 1:10m state outlines, and colors come from the CSS tokens so it follows the theme.

## Blog post icons

Posts have no cover image. Cards show a category chip and watermark icon picked from the post's first category (`TAG_ICONS` in `src/lib/tags.ts`), falling back to a file icon.

## Comments

Blog posts can carry [Giscus](https://giscus.app) threads. The widget stays off until `repoId` and `categoryId` are filled in under `giscus` in `src/lib/site.ts` — giscus.app rejects a mount without them, and a visible "giscus is not installed" error is worse than no comments at all.
