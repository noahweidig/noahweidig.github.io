# CLAUDE.md

Guidance for Claude Code sessions working in this repo. Read this before making
changes; it captures conventions that aren't obvious from a single file.

## What this is

Astro 7 + TypeScript + Tailwind v4 personal site (noahweidig.com), deployed to
GitHub Pages from `main` via `.github/workflows/publish.yml`. Netlify only
does PR deploy previews (see `netlify.toml`). `package.json` has `"type":
"module"` — plain Node scripts are ESM (`.mjs`/`.js`), vendored CommonJS goes
in `.cjs` files.

## Layouts

- `src/layouts/Base.astro` — the `<html>` shell. Owns all meta tags (title,
  description, canonical, OG/Twitter, JSON-LD `Person`/`WebSite`), theme
  script. Every page ends up here.
- `src/layouts/Page.astro` — Base + a centered hero header (kicker, h1, intro)
  for simple content pages (privacy, contact).
- `src/layouts/Detail.astro` — Base + the shared "single content item" shell
  used by publications/awards/education/experience/projects detail
  pages: breadcrumbs, chips, prev/next, ToC, etc.
- `src/layouts/Print.astro` — standalone, no header/footer/scripts, used only
  by `scripts/generate/pdfs.mjs` (Puppeteer) to render the printable CV/résumé.

`Detail` (and pages using it) support a `metaTitle` prop distinct from
`title`: `title` is what renders in the visible `<h1>`, `metaTitle` overrides
what goes in `<title>`/`og:title` only. Use it to disambiguate near-duplicate
titles or to shorten a long title for the tab/SERP without touching the H1 —
see `truncateTitle()` in `src/lib/format.ts` and its use in
`publications|awards|education|experience/[...slug].astro`.

## Styling

Tailwind v4, tokens defined as CSS custom properties in `src/styles/global.css`
under `:root` (`--c-accent`, `--c-line`, `--c-dim`, `--c-moss`, `--c-ember`,
`--c-violet`, etc.) and re-mapped to Tailwind's `--color-*` namespace a few
lines down — that's what makes `bg-line`, `text-dim`, `border-line` etc. work
as utilities. Reuse existing primitives (`.card`, `.chip`, `.chip-accent`,
`.btn`, `.shell`/`.shell-narrow`) instead of inventing new surface styles; a
new page should look like it belongs, not like a bolted-on tool.

## Content collections

`src/content/{projects,publications,awards,experience,education}` — each
entry is `index.md` with frontmatter. `astro.config.mjs` reads the publication
frontmatter directly (not through `astro:content`) to maintain
`noindexedPaths` for publication "appearance of" duplicates. The sitemap integration's `filter()` also
hardcodes exclusions for non-content routes that shouldn't be indexed
(`/404`) — add a new
diagnostic/dev-only route there too, don't rely on the page's own `noindex`
meta tag to keep it out of `sitemap.xml`.

## Scheduled refresh

`.github/workflows/bot.yml` is the one scheduled bot (PR checks are `ci-*.yml`
and the jobs in `publish.yml`). Each Monday it runs the generators in order
(`scripts/sync/*`, then `scripts/generate/{project,publication}-shots`, a
build, then `scripts/generate/pdfs`), commits once with `contents: write` on
that job only, and a `deploy` job gated on `needs.refresh.outputs.committed ==
'true'` calls `./.github/workflows/publish.yml` via `workflow_call` (a push
with `GITHUB_TOKEN` cannot trigger another workflow). To add a generator, add
its step before the commit and its output paths to the `git add` list. Any
failing step fails the run before anything is committed.

**Always install via `.github/actions/build-site`** (the composite action)
rather than hand-rolling `npm ci` + `npm run build:fast` in a workflow. It
already runs `npm ci --ignore-scripts --no-audit --no-fund --prefer-offline`
— SonarCloud's Security Rating gate flags a bare `npm ci` in a workflow as a
vulnerability (arbitrary lifecycle-script execution on the runner), and this
repo's Quality Gate fails the PR check on that alone.

## CI gates on a PR

- `lint` = `prettier --check .` (via `prettier-plugin-astro`) + `astro check`.
  Config is `.prettierrc.json`: `printWidth: 100`, `singleQuote: true`.
- `SonarCloud Code Analysis` — the Quality Gate here specifically requires
  Security Rating ≥ A on new code. It does _not_ appear to gate on the many
  CODE_SMELL findings (cognitive complexity, regex backtracking, prefer
  `node:fs` over `fs`, etc.) that show up on any nontrivial new JS file —
  only `VULNERABILITY`-type findings matter for this check. Query
  `https://sonarcloud.io/api/issues/search?componentKeys=noahweidig_new-website&pullRequest=<N>&resolved=false`
  to see exactly what's flagged rather than guessing from the check summary,
  which only names the failed _condition_, not the issue.
- `lhci` and `lychee` also run per PR, as jobs in `publish.yml` that reuse the
  `build` job's `dist/` artifact — see that file if one of these fails.

## Sandbox / environment notes

`npm ci` in the Claude Code sandbox used for this repo has been extremely
slow (minutes, sometimes killed) — the tree pulls in Puppeteer, Lighthouse,
and other heavy devDependencies. If a full install is impractical:

- Prettier + `prettier-plugin-astro` can often be run from an `npx` cache
  left over from a previous attempt: check
  `find /root/.npm/_npx -iname prettier -type d` before trying to install
  again.
- Prefer letting CI do the real build/typecheck rather than blocking on a
  local `npm ci` — push and watch the PR checks instead of forcing a local
  `npm run build` to complete.
- For a new Node script with no npm dependencies, `node --check <file>` is a
  fast local sanity check that doesn't need `node_modules` at all.
- `.npmrc` sets `engine-strict` and `package.json` requires Node
  `>=22.23.4` (same as `.nvmrc`), so `npm ci` refuses to run on an older Node
  such as the sandbox's 22.22. `npm test` is Node's built-in runner
  (`node --test`) and needs no install: test files import `./x.ts` directly.
