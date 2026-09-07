// Checks that the contact form on production is still wired to a live endpoint.
//
//   node scripts/check-contact-form.mjs --base https://noahweidig.com
//
// Run weekly by .github/workflows/production-audit.yml. A silently dead
// contact form is the worst failure on this site: the form is the conversion
// point every page funnels toward, and nothing would notice if the endpoint
// were removed, disabled, or over quota (#273).
//
// This used to be a curl pipeline in the workflow. Cloudflare answered curl
// with HTTP 403 on the very first request of every scheduled run, so the form
// was never actually checked. The same Cloudflare zone serves 200 to the real
// Chrome the Lighthouse job drives, so this reads the page through Puppeteer
// — the browser the axe job already installs — and keeps curl-equivalent
// plain fetches only for formspree.io, which is not behind that zone.

import puppeteer from 'puppeteer';

function parseArgs(argv) {
  const args = { base: 'https://noahweidig.com' };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--base') args.base = argv[++i];
    else throw new Error(`Unknown argument: ${argv[i]}`);
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const base = args.base.replace(/\/$/, '');

// /contact/ with the trailing slash: /contact is the legacy public/contact.html
// stub, whose only content is a meta refresh, so it carries no form.
const PAGE_URL = `${base}/contact/`;

// Puppeteer's default UA carries "HeadlessChrome", which Cloudflare answers
// with a bot interstitial. Same UA the axe audit sends, for the same reason.
const UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'Chrome/140.0.0.0 Safari/537.36';

// A Cloudflare WAF skip rule can be keyed on a header only this audit sends,
// which is the durable way past bot mitigation (#95). Both halves come from
// repository secrets; with them unset nothing extra is sent.
const BYPASS_HEADER = process.env.AUDIT_BYPASS_HEADER || '';
const BYPASS_TOKEN = process.env.AUDIT_BYPASS_TOKEN || '';
const EXTRA_HEADERS = BYPASS_HEADER && BYPASS_TOKEN ? { [BYPASS_HEADER]: BYPASS_TOKEN } : null;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function fail(message) {
  console.log(`::error::${message}`);
  process.exit(1);
}

const browser = await puppeteer.launch({
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

// Cloudflare's bot mitigation is rate-shaped as well as fingerprint-shaped:
// a blocked request is often served fine a minute later. Retrying costs a few
// seconds on a good run and is the difference between a checked form and an
// unchecked one on a bad one.
const DELAYS_MS = [0, 15_000, 45_000];
let action = null;
let lastStatus = 0;

for (const delay of DELAYS_MS) {
  if (delay) await sleep(delay);
  const tab = await browser.newPage();
  try {
    await tab.setUserAgent(UA);
    if (EXTRA_HEADERS) await tab.setExtraHTTPHeaders(EXTRA_HEADERS);
    const response = await tab.goto(PAGE_URL, { waitUntil: 'domcontentloaded' });
    lastStatus = response ? response.status() : 0;
    action = await tab.evaluate(() => {
      const form = document.querySelector('form[action^="https://formspree.io/f/"]');
      return form ? form.getAttribute('action') : null;
    });
  } catch (err) {
    console.log(`Attempt failed for ${PAGE_URL}: ${err.message}`);
  } finally {
    await tab.close();
  }
  if (action) break;
  console.log(`No Formspree form on ${PAGE_URL} (HTTP ${lastStatus}); retrying.`);
}

await browser.close();

if (!action) {
  if (lastStatus === 403 || lastStatus === 429 || lastStatus === 503) {
    fail(
      `HTTP ${lastStatus} for ${PAGE_URL} after ${DELAYS_MS.length} attempts — bot ` +
        'mitigation, not the page. The form was not checked. See #95.',
    );
  }
  fail(`No Formspree form found on ${PAGE_URL} (HTTP ${lastStatus})`);
}

console.log(`Endpoint: ${action}`);

// --proto '=https' equivalent: this URL was read out of a response, so a
// downgrade to plain HTTP must fail loudly rather than be followed.
if (!action.startsWith('https://')) fail(`Form action is not https: ${action}`);

// A CORS preflight: it exercises the real endpoint and tells a live form apart
// from a deleted or disabled one, without delivering a test message to the
// inbox on every scheduled run.
const preflight = await fetch(action, {
  method: 'OPTIONS',
  redirect: 'error',
  headers: {
    'User-Agent': UA,
    Origin: base,
    'Access-Control-Request-Method': 'POST',
    'Access-Control-Request-Headers': 'content-type',
  },
});

console.log(`Preflight: HTTP ${preflight.status}`);
if (preflight.status !== 200 && preflight.status !== 204) {
  fail(`Formspree endpoint returned HTTP ${preflight.status}`);
}
