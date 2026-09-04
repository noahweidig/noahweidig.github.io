<h1 align="center">Noah Weidig</h1>

<p align="center">
  <strong>GIS Analyst · Data Scientist</strong><br/>
  Translating complex geospatial data into clear insight about how our world changes.
</p>

<p align="center">
  <a href="https://noahweidig.com"><b>noahweidig.com</b></a>
  &nbsp;•&nbsp;
  <a href="https://noahweidig.com/projects">Projects</a>
  &nbsp;•&nbsp;
  <a href="https://noahweidig.com/publications">Publications</a>
  &nbsp;•&nbsp;
  <a href="https://noahweidig.com/blog">Blog</a>
  &nbsp;•&nbsp;
  <a href="mailto:noah@noahweidig.com">noah@noahweidig.com</a>
</p>

![demo](https://raw.githubusercontent.com/noahweidig/noahweidig.github.io/main/public/media/noahweidigcom.webp)

---

## Forking This Repository

Yes, you’re welcome to fork and use this code for your own website. I’m happy to keep the project open source and encourage others to build on it.

However, please don’t present the design or code as your own. I put a significant amount of time and effort into creating this site, and I’d really appreciate it if you kept the original attribution intact.

## TL;DR

Feel free to fork and customize this repository. Just give proper credit by linking back to [noahweidig.com](https://noahweidig.com).

Thanks for respecting the work and helping keep the project open source!

## About

I leverage remote sensing, GIS, and data science to translate complex data into clear insight about how our world changes. I believe understanding patterns through time gives people the power to see beyond the moment and shape a more intentional world.

Currently a **GIS & Remote Sensing Research Associate** at the University of Florida, with a focus on wildland-urban interface (WUI) risk, land-use change, and spatial decision-making.

Actively seeking **Data Scientist** or **GIS Analyst** roles.

📄 [Download Resume](https://noahweidig.com/uploads/resume.pdf)

### Where the content lives

Projects, experience, education, awards and the skills list are generated from
the Markdown front matter in `src/content/`, so the site is always the current
version of them. This README used to keep a second, hand-typed copy of each
one; those copies drifted, so they are now links (#252):

|                 |                                       |
| --------------- | ------------------------------------- |
| Projects        | <https://noahweidig.com/projects>     |
| Publications    | <https://noahweidig.com/publications> |
| Experience      | <https://noahweidig.com/experience>   |
| Education       | <https://noahweidig.com/education>    |
| Awards & grants | <https://noahweidig.com/awards>       |
| CV              | <https://noahweidig.com/cv>           |
| Writing         | <https://noahweidig.com/blog>         |

---

## This Site

Built with [Astro 7](https://astro.build), TypeScript and [Tailwind CSS 4](https://tailwindcss.com), deployed to GitHub Pages — no external theme dependency. Everything ships as static HTML: there is no framework runtime on the page, only a single hand-written module (`src/scripts/ui.ts`) for the theme toggle, search dialog, filters and scroll reveals.

### Layout

| Path                    | Holds                                                                         |
| ----------------------- | ----------------------------------------------------------------------------- |
| `src/content/`          | the site's content, one Markdown file per entry, in six collections           |
| `src/content.config.ts` | the Zod schema each collection is validated against at build time             |
| `src/pages/`            | routes — file-based, with `[...slug].astro` generating every detail page      |
| `src/layouts/`          | `Base` (head, chrome, analytics), `Page` (section index), `Detail` (article)  |
| `src/components/`       | cards, rows, marquees, the search dialog, the globe                           |
| `src/styles/`           | the design tokens and component layer; `fonts.css` holds the `@font-face` set |
| `src/lib/`              | site constants and the date/citation formatters                               |
| `public/`               | static assets served verbatim — media, fonts, PDFs, favicons                  |

Content lives in a directory per entry (`src/content/blog/focus/index.md`), so a post's cover image sits next to the post that uses it and Astro's image pipeline can optimize it. The directory name is the URL slug.

### Design system

`src/styles/global.css` is the single source of truth. Every semantic color is a runtime custom property, so the theme toggle repaints the whole system by flipping one `data-theme` attribute on `<html>` — no duplicate stylesheet, no flash on load (the value is applied by an inline script before first paint). Tailwind's `@theme inline` block maps those properties onto utility classes, so `bg-surface` and `text-dim` resolve to whichever theme is active.

[`/styleguide`](https://noahweidig.com/styleguide) renders every token, the type scale, and each component live, in whichever theme you are reading in.

### URLs and the base path

The site is published at the apex: **https://noahweidig.com**. The base path lives in one place, `base` in `astro.config.mjs`, and is `/` today. Astro prefixes the routes and assets it generates itself; a URL written by hand goes through `u()` from `src/lib/url.ts`, which reads the same value back out of `import.meta.env.BASE_URL`, so the site survives a base path being set again:

```astro
---
import { u } from '../lib/url';
---

<a href={u('/projects/')}>Projects</a>
```

Three places can't call it, and each has its own answer. URLs inside a content file are written **relative** to the page (`../../media/…`), so they resolve under any base. The topography texture is a CSS background, and a stylesheet can't read the base, so `src/layouts/Base.astro` stamps `--topo-url`. Client-side code reads the base off `document.documentElement.dataset.base`, which the same layout sets — that's how the Pagefind bundle and its result URLs get prefixed.

Section routes keep their paths. Four pages Quarto rendered as `<name>.html` are directory routes now — `/contact/`, `/cv/`, `/privacy/`, `/styleguide/` — with a redirect stub committed at each old path under `public/`. The feed is served at both `/rss.xml` and its old address, `/blog/index.xml`; a meta-refresh stub is no use to a feed reader, so `src/pages/blog/index.xml.ts` re-exports the same route.

`public/CNAME` carries `noahweidig.com`, which claims the domain's **root** for this repo. GitHub Pages needs the file in the published output on every deploy, so it is committed rather than set in the repo's Pages settings alone.

### Search

[Pagefind](https://pagefind.app) indexes the built site as a post-build step and the dialog (⌘K, or `/`) loads it on first use. The index only covers `<main>`; the header, footer and search dialog itself are marked `data-pagefind-ignore`.

### Publications

Publications under `src/content/publications/` are regenerated from Zotero on the **1st and 15th** of each month by `.github/workflows/update-pubs.yml` (do not edit by hand). That workflow pushes with `GITHUB_TOKEN`, which cannot fire a `push` event, so it calls `publish.yml` directly (`workflow_call`) once it has committed — the deploy runs inside the sync's own run and fails it if it fails, rather than depending on a trigger that can be silently disabled. Every push to `main` rebuilds and publishes through the same workflow.

Public PDF attachments in the Zotero library are downloaded to `public/publications/<slug>/<slug>.pdf` and surfaced as a **View PDF** button on the publication page and in the publications listing; the BibTeX record lands beside it as `cite.bib`.

Zotero exports one record per _appearance_, so a talk given at four venues arrives as four near-identical items. The sync marks the most recent of each cluster `pub-listed: "yes"` and hangs the venue run off it, so the index shows one row per work while every appearance keeps its own page.

### Toolchain

| Tool                | Pinned in                            | Used for                                |
| ------------------- | ------------------------------------ | --------------------------------------- |
| Node                | `.nvmrc`                             | the build and the `scripts/` tooling    |
| Astro / Tailwind    | `package.json` + `package-lock.json` | the build itself                        |
| npm devDependencies | `package.json` + `package-lock.json` | pagefind, puppeteer, axe-core, prettier |

### Commands

```sh
npm install                    # install the toolchain
npm run dev                    # local dev server with HMR
npm run build                  # astro check + build to dist/ + pagefind index
npm run build:fast             # same, without the type check
npm run preview                # serve dist/
npm run a11y                   # axe-core over dist (or --base https://noahweidig.com)
npm run globe                  # redraw the homepage globe SVG
npm run lint                   # prettier --check + astro check
npm run format                 # prettier --write
node scripts/update-pubs.js    # refresh publications from Zotero
```

`npm run lint` is the gate on the input: Prettier for formatting (`.prettierrc.json`, `.editorconfig`) and `astro check` for types, which covers every component, page, and content-collection schema. It runs as the `lint` job in `publish.yml`.

### Continuous integration

| Workflow               | Runs on                                       | Does                                                                       |
| ---------------------- | --------------------------------------------- | -------------------------------------------------------------------------- |
| `publish.yml`          | push to `main`, PR, called by the Zotero sync | lints, builds, deploys to Pages                                            |
| `axe.yml`              | PR                                            | axe-core (`heading-order`) over the built site                             |
| `lighthouse.yml`       | PR                                            | Lighthouse with score assertions and resource budgets (`lighthouserc.cjs`) |
| `links.yml`            | PR, monthly                                   | lychee over the built site                                                 |
| `production-audit.yml` | weekly                                        | Lighthouse, axe and lychee against the **live** site                       |

Every workflow that needs a build goes through the `.github/actions/build-site` composite action, so each check scores the same bytes that get deployed.

### The homepage globe

The globe in the closing CTA is static — one fixed rotation with Orlando facing the camera — so it is projected at build time rather than drawn in the browser. `scripts/generate-globe-svg.mjs` reads world-atlas 110m TopoJSON, projects the borders and graticule, simplifies them, and writes the SVG into `src/components/Globe.astro` between the `<!-- globe:start -->` and `<!-- globe:end -->` markers. Run `npm run globe` to redraw it; nothing else needs to change.

### Blog cover images

Every post carries a 1200×675 cover, referenced from the post's front matter as `image: "./cover.webp"` and served through Astro's image pipeline, which emits the responsive `srcset` for the cards on the homepage and `/blog/`. A post with no `image:` still renders — the card falls back to the text-only layout.

### Comments

Blog posts can carry [Giscus](https://giscus.app) threads. The widget stays off until `repoId` and `categoryId` are filled in under `giscus` in `src/lib/site.ts` — giscus.app rejects a mount without them, and a visible "giscus is not installed" error is worse than no comments at all.

---

MIT © 2026 Noah Weidig
