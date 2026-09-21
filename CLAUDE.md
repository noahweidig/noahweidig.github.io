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
  script, analytics. Every page ends up here.
- `src/layouts/Page.astro` — Base + a centered hero header (kicker, h1, intro)
  for simple content pages (privacy, contact, styleguide, seo).
- `src/layouts/Detail.astro` — Base + the shared "single content item" shell
  used by publications/awards/education/experience/projects/blog detail
  pages: breadcrumbs, chips, prev/next, ToC, etc.
- `src/layouts/Print.astro` — standalone, no header/footer/scripts, used only
  by `scripts/generate-pdfs.mjs` (Puppeteer) to render the printable CV/résumé.

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

`src/content/{blog,projects,publications,awards,experience,education}` — each
entry is `index.md` with frontmatter. `astro.config.mjs` reads these
frontmatter files directly (not through `astro:content`) to compute sitemap
`lastmod` per path, and maintains `noindexedPaths` for publication
"appearance of" duplicates. The sitemap integration's `filter()` also
hardcodes exclusions for non-content routes that shouldn't be indexed
(`/404`, `/500`, `/styleguide`, `/seo`, `/blog/write`) — add a new
diagnostic/dev-only route there too, don't rely on the page's own `noindex`
meta tag to keep it out of `sitemap.xml`.

## Scheduled bot-commit workflows

Pattern used by `update-citation-stats.yml` and `seo-audit.yml`: a weekly
`schedule` + `workflow_dispatch` trigger, `contents: write` only on the job
that needs it, a script writes to a file under `src/data/`, then:

```yaml
git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
git add src/data/<file>.json
if git diff --cached --quiet; then
echo "committed=false" >> "$GITHUB_OUTPUT"; exit 0
fi
echo "committed=true" >> "$GITHUB_OUTPUT"
git commit -m "..."
# push with retry/backoff
```

...followed by a `deploy` job gated on `needs.<job>.outputs.committed ==
'true'` that calls `./.github/workflows/publish.yml` via `workflow_call`. Copy
this shape rather than inventing a new one.

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
- `axe`, `lychee`, `lhci`, `post-audit` also run per PR — see their workflow
  files if one of these fails.

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

## Vendoring third-party code

`scripts/seo-audit/lib/` vendors the auditor modules from
[noahweidig/seo](https://github.com/noahweidig/seo) (MIT) as `.cjs` files
(this project is `"type": "module"`, so vendored CommonJS needs the `.cjs`
extension — ESM can `import` a `.cjs` file directly and Node's CJS/ESM
interop will pick up its named `module.exports`). Each vendored file carries
a short header comment naming its origin and pointing at the LICENSE copy.
If you need to update a vendored file, re-copy from upstream and redo the
`require('../foo.js')` → `require('../foo.cjs')` extension fix rather than
hand-editing the vendored copy in place.

## SEO dashboard

`/seo/` (`src/pages/seo.astro`) renders `src/data/seo-audit.json`, regenerated
weekly by `.github/workflows/seo-audit.yml` (`node scripts/run-seo-audit.mjs`
against a real `dist/` build). The page is `noindex` — it's a diagnostics
tool, not content. If the JSON's `totalPages` is `0`, that's the placeholder
committed before the workflow's first run, not a broken audit.
