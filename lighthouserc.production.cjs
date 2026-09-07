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

const allowInjectedRobotsTxt = (assertions) => {
  const [level, options] = assertions['categories:seo'];
  return {
    ...assertions,
    'categories:seo': [
      level,
      // Rounded: 0.65 - 0.08 lands on 0.5700000000000001 in binary floating
      // point, which compares fine but reads like a typo in the config.
      {
        ...options,
        minScore: Math.round((options.minScore - SEO_ROBOTS_TXT_FALSE_POSITIVE) * 100) / 100,
      },
    ],
  };
};

// Deliberately not adjusted: performance, total-blocking-time and
// best-practices are all below their floors in production too, and unlike the
// SEO gap those look like real differences in what visitors are served rather
// than audit bugs. Production runs Cloudflare Rocket Loader, which rewrites
// every `type="module"` on the page into its own deferred loader — the built
// site has no such script, which is why the PR run does not see any of this.
// Turning Rocket Loader off in the Cloudflare dashboard is the change to try;
// leaving these assertions to fail is what keeps that visible. The reports the
// workflow now uploads name the audits behind the best-practices score.
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
      assertMatrix: assertMatrix('^https?://[^/]+/$', allowInjectedRobotsTxt),
    },
  },
};
