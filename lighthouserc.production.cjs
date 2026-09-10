// Lighthouse against the live site, run weekly by
// .github/workflows/production-audit.yml. Same assertions as the PR config
// (lighthouserc.cjs) — the point is that production is held to the bar a PR
// is held to, and that there is a trend line for Core Web Vitals over time
// rather than only per-PR snapshots (#256).
const { assertMatrix } = require('./lighthouserc.cjs');

const SITE = process.env.SITE_URL || 'https://noahweidig.com';

// The one place production is not held to the PR bar.
//
// Every production run so far has scored SEO exactly 0.08 below the PR run on
// every URL: 0.92 against a floor of 1.00 on the six ordinary pages, and 0.58
// against 0.65 on /styleguide/. One audit, `robots-txt`, and it is a false
// positive that no change to this site can clear.
//
// Cloudflare prepends its own managed block to public/robots.txt, and that
// block sets `Content-Signal:` — the AI-crawler opt-out directive. Lighthouse
// validates every robots.txt line against a safelist of directive names and
// fails the audit on anything it does not recognise. `content-signal` was
// added to that safelist in Lighthouse 13. The audit runs under Lighthouse
// 12.6.1, which @lhci/cli 0.15.1 pins exactly and 0.15.1 is the newest
// @lhci/cli there is, so the CI runner cannot reach the version that has the
// fix. Fetching https://noahweidig.com/robots.txt shows the injected block;
// public/robots.txt in this repo is four valid lines.
//
// So the floors here are the PR floors minus that fixed 0.08. A robots.txt
// that actually broke would drop further and still fail. Delete this and go
// back to a bare assertMatrix(pattern) call when either the Cloudflare managed
// robots.txt is turned off in the dashboard, or @lhci/cli ships Lighthouse 13.
const SEO_ROBOTS_TXT_FALSE_POSITIVE = 0.08;

// The second injected-audit gap, same shape as the one above.
//
// Every production run scores best-practices 0.82 against a floor of 0.95 on
// every URL. The uploaded reports name one failing audit and it is the same
// one on all six pages: `deprecations`, weight 5, with three warnings —
// SharedStorage, StorageType.persistent, and Fledge. All three have the same
// source, https://noahweidig.com/cdn-cgi/challenge-platform/scripts/jsd/main.js,
// which is Cloudflare's bot-detection script. No script this repo ships
// appears in that audit, and no other best-practices audit is below 1.00.
//
// So the floor here is the PR floor minus that fixed 0.13. A real
// best-practices regression adds a second failing audit and drops below it.
// Delete this and go back to the PR floor when Cloudflare stops injecting the
// challenge script — the same dashboard change (Bot Fight Mode / JS
// detections off) that would stop the axe job being served 403 on 9 of its 10
// pages (#95).
const BEST_PRACTICES_CF_CHALLENGE_SCRIPT = 0.13;

// Rounded: 0.65 - 0.08 lands on 0.5700000000000001 in binary floating point,
// which compares fine but reads like a typo in a failure message.
const lower = (assertions, key, by) => {
  const [level, options] = assertions[key];
  return {
    ...assertions,
    [key]: [level, { ...options, minScore: Math.round((options.minScore - by) * 100) / 100 }],
  };
};

const allowInjectedScripts = (assertions) =>
  lower(
    lower(assertions, 'categories:seo', SEO_ROBOTS_TXT_FALSE_POSITIVE),
    'categories:best-practices',
    BEST_PRACTICES_CF_CHALLENGE_SCRIPT,
  );

// Deliberately not adjusted: performance, total-blocking-time and
// largest-contentful-paint are below their floors in production too, and those
// are real differences in what visitors are served rather than audit bugs.
// Two things production has that a PR build does not: Cloudflare Rocket
// Loader, which rewrites every `type="module"` on the page into its own
// deferred loader, and the challenge script above, which the 2026-09-07
// reports measured at 1,896ms of script evaluation on the homepage against
// 2,311ms for the whole of the site's own JavaScript. Turning both off in the
// Cloudflare dashboard is the change to try; leaving these assertions to fail
// is what keeps that visible.
module.exports = {
  ci: {
    collect: {
      url: [
        `${SITE}/`,
        `${SITE}/cv/`,
        `${SITE}/projects/`,
        `${SITE}/publications/`,
        `${SITE}/blog/`,
        `${SITE}/styleguide/`,
      ],
    },
    upload: {
      target: 'temporary-public-storage',
    },
    assert: {
      assertMatrix: assertMatrix('^https?://[^/]+/$', allowInjectedScripts),
    },
  },
};
