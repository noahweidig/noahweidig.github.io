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

📄 [Download Resume](https://noahweidig.com/resume.pdf)

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

Built with [Astro 7](https://astro.build), TypeScript and [Tailwind CSS 4](https://tailwindcss.com), deployed to GitHub Pages — no external theme dependency. Everything ships as static HTML: there is no framework runtime on the page, only a single hand-written module (`src/client/ui.ts`) for the theme toggle, search dialog, filters and scroll reveals.

### Layout

| Path                    | Holds                                                                         |
| ----------------------- | ----------------------------------------------------------------------------- |
| `src/content/`          | the site's content, one Markdown file per entry, in six collections           |
| `src/content.config.ts` | the Zod schema each collection is validated against at build time             |
| `src/pages/`            | routes — file-based, with `[...slug].astro` generating every detail page      |
| `src/layouts/`          | `Base` (head, chrome), `Page` (section index), `Detail` (article)             |
| `src/components/`       | cards, rows, the search dialog, the map                                       |
| `src/styles/`           | the design tokens and component layer; `fonts.css` holds the `@font-face` set |
| `src/lib/`              | site constants and the date/citation formatters                               |
| `src/client/`           | the browser-side modules behind `ui.ts` (theme, search, filters, ...)         |
| `scripts/`              | build-time tooling: `generate/`, `sync/` and `check/`                         |
| `docs/`                 | longer notes on the content pipelines, URLs and design tokens                 |
| `public/`               | static assets served verbatim — media, fonts, PDFs, favicons                  |

Content lives in a directory per entry (`src/content/blog/focus/index.md`). The directory name is the URL slug.

### Commands

```sh
npm install      # install the toolchain
npm run dev      # local dev server
npm run build    # astro check + build to dist/ + pagefind index
npm run preview  # serve dist/
npm run lint     # prettier --check + astro check + token check
npm test         # node --test
```

`npm run` lists the rest (cover art, PDFs, screenshots). `npm run lint` is the gate: Prettier (`.prettierrc.json`), `astro check` for types, and `scripts/check/tokens.mjs`, which fails on hardcoded hex colors outside `src/styles/global.css`.

### Deploy and automation

Every push to `main` builds and publishes to GitHub Pages through `.github/workflows/publish.yml`; pull requests get a Netlify deploy preview. The other workflows are named by role:

- `ci-*.yml` run on pull requests (typos, workflow linting, dependency scans) or on a schedule (the monthly link sweep). Lighthouse and the link check run as jobs in `publish.yml`, reusing its build.
- `bot-*.yml` run on a schedule, commit regenerated files to `main` and call `publish.yml` to deploy (Zotero sync, citation stats, project and publication screenshots, CV and résumé PDFs).

Every workflow that needs a build goes through the `.github/actions/build-site` composite action, so each check scores the same bytes that get deployed. Scripts live in `scripts/`: `generate/` (art, icons, PDFs), `sync/` (Zotero, citation stats) and `check/` (axe, tokens, contact form, giscus). Browser code is `src/client/`.

More detail on the content pipelines, URLs, search and design tokens is in [`docs/architecture.md`](docs/architecture.md).

---

MIT © 2026 Noah Weidig
