// Vendored from https://github.com/noahweidig/seo (astro-seo-audit), MIT licensed.
// See LICENSE-astro-seo-audit.txt in this directory. Do not hand-edit; re-copy
// from upstream and re-run the sed fixups in the vendoring commit if it changes.

'use strict';

const { getRelativePath } = require('../utils.cjs');

/**
 * Audit hreflang tags for internationalization.
 * @param {Array<{filePath: string, html: string}>} pages
 * @param {string} distDir
 * @returns {Object} Audit results.
 */
function auditHreflang(pages, distDir) {
  const results = {
    name: 'Hreflang',
    passes: [],
    warnings: [],
    errors: [],
  };

  // Detect if the site uses i18n by checking for locale patterns in paths
  const localePattern = /^\/([a-z]{2}(?:-[a-z]{2})?)\//i;
  const localesFound = new Set();
  const pagesByLocale = new Map();

  for (const { filePath } of pages) {
    const pagePath = getRelativePath(filePath, distDir);
    const localeMatch = pagePath.match(localePattern);
    if (localeMatch) {
      localesFound.add(localeMatch[1].toLowerCase());
      if (!pagesByLocale.has(localeMatch[1].toLowerCase())) {
        pagesByLocale.set(localeMatch[1].toLowerCase(), []);
      }
      pagesByLocale.get(localeMatch[1].toLowerCase()).push(pagePath);
    }
  }

  // If no i18n detected, skip
  if (localesFound.size === 0) {
    results.passes.push({
      page: 'all',
      message: 'No i18n locale paths detected (hreflang audit skipped)',
    });
    return results;
  }

  // Build a map of hreflang references per page
  const hreflangMap = new Map();

  for (const { filePath, html } of pages) {
    const pagePath = getRelativePath(filePath, distDir);
    const hreflangTags = [];
    const hreflangRegex =
      /<link[^>]+rel=["']alternate["'][^>]+hreflang=["']([^"']*)["'][^>]+href=["']([^"']*)["'][^>]*\/?>/gi;
    const hreflangRegex2 =
      /<link[^>]+hreflang=["']([^"']*)["'][^>]+href=["']([^"']*)["'][^>]*rel=["']alternate["'][^>]*\/?>/gi;
    const hreflangRegex3 =
      /<link[^>]+href=["']([^"']*)["'][^>]+hreflang=["']([^"']*)["'][^>]*rel=["']alternate["'][^>]*\/?>/gi;

    let match;
    while ((match = hreflangRegex.exec(html)) !== null) {
      hreflangTags.push({ lang: match[1], href: match[2] });
    }
    while ((match = hreflangRegex2.exec(html)) !== null) {
      hreflangTags.push({ lang: match[1], href: match[2] });
    }
    while ((match = hreflangRegex3.exec(html)) !== null) {
      hreflangTags.push({ lang: match[2], href: match[1] });
    }

    hreflangMap.set(pagePath, hreflangTags);

    const localeMatch = pagePath.match(localePattern);
    if (!localeMatch) continue; // Non-locale page

    // Check if hreflang tags exist
    if (hreflangTags.length === 0) {
      results.errors.push({
        page: pagePath,
        message: 'i18n page missing hreflang tags',
      });
      continue;
    }

    // Check self-referencing hreflang
    const currentLocale = localeMatch[1].toLowerCase();
    const selfRef = hreflangTags.find(
      (t) => t.lang.toLowerCase() === currentLocale || t.href.includes(`/${currentLocale}/`),
    );
    if (!selfRef) {
      results.errors.push({
        page: pagePath,
        message: 'Missing self-referencing hreflang tag',
      });
    } else {
      results.passes.push({ page: pagePath, message: 'Self-referencing hreflang present' });
    }

    // Check x-default
    const hasXDefault = hreflangTags.some((t) => t.lang === 'x-default');
    if (!hasXDefault) {
      results.warnings.push({
        page: pagePath,
        message: 'Missing x-default hreflang',
      });
    } else {
      results.passes.push({ page: pagePath, message: 'x-default hreflang set' });
    }

    // Check that all known locales are referenced
    for (const locale of localesFound) {
      if (locale === currentLocale) continue;
      const hasLocaleRef = hreflangTags.some(
        (t) => t.lang.toLowerCase() === locale || t.href.includes(`/${locale}/`),
      );
      if (!hasLocaleRef) {
        results.warnings.push({
          page: pagePath,
          message: `Missing hreflang reference for locale "${locale}"`,
        });
      }
    }
  }

  // Bidirectional check: if page A references page B, page B should reference page A
  for (const [pagePath, tags] of hreflangMap) {
    for (const tag of tags) {
      const targetUrl = tag.href;
      // Try to find the target page in our map
      for (const [otherPage, otherTags] of hreflangMap) {
        if (otherPage === pagePath) continue;
        // Check if the target URL might correspond to otherPage
        if (targetUrl.endsWith(otherPage) || otherPage.includes(targetUrl)) {
          const backRef = otherTags.some(
            (t) => t.href.endsWith(pagePath) || pagePath.includes(t.href),
          );
          if (!backRef) {
            results.warnings.push({
              page: pagePath,
              message: `Bidirectional hreflang missing: ${pagePath} -> ${otherPage} but not vice versa`,
            });
          }
        }
      }
    }
  }

  return results;
}

module.exports = { auditHreflang };
