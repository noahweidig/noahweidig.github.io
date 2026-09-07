// Runs axe-core over the site's key pages and exits non-zero on violations.
//
//   node scripts/axe-audit.mjs                     # ./dist, read off disk
//   node scripts/axe-audit.mjs --dir dist
//   node scripts/axe-audit.mjs --base https://noahweidig.com
//
// Lived in a heredoc inside .github/workflows/axe.yml until #249/#256: as a
// file it can run locally (`npm run a11y`), it can point at production for
// the scheduled audit, and its dependencies are pinned in package.json
// instead of in a workflow string.

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import puppeteer from 'puppeteer';

const require = createRequire(import.meta.url);
const axeSource = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');

const PAGES = [
  'index.html',
  'cv/index.html',
  'experience/index.html',
  'education/index.html',
  'projects/index.html',
  'publications/index.html',
  'blog/index.html',
  'contact/index.html',
  // The 404 page carries the site chrome now, so it gets checked like any other.
  '404.html',
  // Renders every token and component on one page (#222), so a regression in
  // any component fails here regardless of which page it ships on.
  'styleguide/index.html',
];

// Full default rule set: a scan restricted to `heading-order` only caught one
// class of regression. A run with no `runOnly` restriction is clean across
// every page in PAGES as of this writing, so the gate now covers all of it
// (color contrast, landmarks, ARIA, forms, etc.) instead of just headings.

function parseArgs(argv) {
  const args = { dir: 'dist', base: null };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--dir') args.dir = argv[++i];
    else if (argv[i] === '--base') args.base = argv[++i];
    else throw new Error(`Unknown argument: ${argv[i]}`);
  }
  return args;
}

// Production serves extensionless URLs; the on-disk build is index.html files.
function toUrl(page, args) {
  if (!args.base) return 'file://' + path.resolve(args.dir, page);
  const clean = page.replace(/index\.html$/, '').replace(/\.html$/, '');
  return new URL(clean, args.base.endsWith('/') ? args.base : args.base + '/').href;
}

const args = parseArgs(process.argv.slice(2));

// The CI container disallows unprivileged user namespaces, so Chrome's own
// sandbox can't initialize (zygote_host_impl_linux.cc: "No usable sandbox!").
// Safe here: the browser only opens this site's own pages.
const browser = await puppeteer.launch({
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

// Puppeteer's default UA carries "HeadlessChrome", which Cloudflare in front
// of production answers with a bot interstitial. The first scheduled
// production audit reported exactly one violation on all ten pages —
// `meta-refresh`, from the interstitial's own refresh tag — which is what a
// challenge page looks like, not the site. Only used against --base; the
// file:// run never reaches a network.
const UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'Chrome/140.0.0.0 Safari/537.36';

// A Cloudflare WAF skip rule can be keyed on a header only this audit sends,
// which is the durable way past bot mitigation when the User-Agent is not the
// trigger (#95). Both halves come from repository secrets, so the header goes
// out only once the rule exists; with them unset nothing extra is sent.
const BYPASS_HEADER = process.env.AUDIT_BYPASS_HEADER || '';
const BYPASS_TOKEN = process.env.AUDIT_BYPASS_TOKEN || '';
const EXTRA_HEADERS = BYPASS_HEADER && BYPASS_TOKEN ? { [BYPASS_HEADER]: BYPASS_TOKEN } : null;

// Every page this site builds carries `data-base` on <html> (Base.astro). A
// response without it is not one of our pages: an interstitial, an error page,
// or a redirect elsewhere. Checking for it keeps "we were not served the site"
// from being reported as an accessibility regression, which is how the first
// two scheduled runs failed (#95).
const SITE_MARKER = 'html[data-base]';

let failed = false;
for (const page of PAGES) {
  const url = toUrl(page, args);
  const tab = await browser.newPage();
  try {
    if (args.base) {
      await tab.setUserAgent(UA);
      if (EXTRA_HEADERS) await tab.setExtraHTTPHeaders(EXTRA_HEADERS);
    }
    const response = await tab.goto(url, { waitUntil: 'networkidle0' });

    const served = await tab.evaluate((sel) => Boolean(document.querySelector(sel)), SITE_MARKER);
    if (!served) {
      failed = true;
      const status = response ? response.status() : 0;
      console.log(`\n=== ${page}: not served the site (HTTP ${status}) ===`);
      console.log(
        `No ${SITE_MARKER} in the response for ${url}, so this is a challenge ` +
          'or error page rather than a page of this site. Nothing was audited ' +
          'here; see #95.',
      );
      continue;
    }

    await tab.evaluate(axeSource);
    const results = await tab.evaluate(() => axe.run());

    if (results.violations.length) {
      failed = true;
      console.log(`\n=== ${page}: ${results.violations.length} violation(s) ===`);
      for (const v of results.violations) {
        console.log(`[${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} node(s))`);
        for (const node of v.nodes) console.log(`  - ${node.target.join(' ')}`);
      }
    } else {
      console.log(`${page}: no violations`);
    }
  } catch (err) {
    failed = true;
    console.log(`\n=== ${page}: could not be audited ===\n${err.message}`);
  } finally {
    await tab.close();
  }
}

await browser.close();
process.exit(failed ? 1 : 0);
