// Vendored from https://github.com/noahweidig/seo (astro-seo-audit), MIT licensed.
// See LICENSE-astro-seo-audit.txt in this directory. Do not hand-edit; re-copy
// from upstream and re-run the sed fixups in the vendoring commit if it changes.

'use strict';

const { getRelativePath, getBody } = require('../utils.cjs');

/**
 * Audit heading structure.
 * @param {Array<{filePath: string, html: string}>} pages
 * @param {string} distDir
 * @returns {Object} Audit results.
 */
function auditHeadings(pages, distDir) {
  const results = {
    name: 'Headings',
    passes: [],
    warnings: [],
    errors: [],
  };

  for (const { filePath, html } of pages) {
    const pagePath = getRelativePath(filePath, distDir);
    const body = getBody(html);

    // Find all headings in order
    const headingRegex = /<(h[1-6])\b[^>]*>([\s\S]*?)<\/\1>/gi;
    const headings = [];
    let match;
    while ((match = headingRegex.exec(body)) !== null) {
      const tag = match[1].toLowerCase();
      const level = parseInt(tag[1], 10);
      // Strip HTML tags from content
      const text = match[2].replace(/<[^>]*>/g, '').trim();
      headings.push({ tag, level, text });
    }

    // Check exactly one h1
    const h1s = headings.filter((h) => h.level === 1);
    if (h1s.length === 0) {
      results.errors.push({ page: pagePath, message: 'No <h1> found on page' });
    } else if (h1s.length > 1) {
      results.errors.push({
        page: pagePath,
        message: `Multiple <h1> tags found (${h1s.length}): "${h1s.map((h) => h.text.slice(0, 30)).join('", "')}"`,
      });
    } else {
      results.passes.push({ page: pagePath, message: 'Exactly one <h1> present' });
    }

    // Check h1 length
    for (const h1 of h1s) {
      if (h1.text.length > 70) {
        results.warnings.push({
          page: pagePath,
          message: `<h1> too long (${h1.text.length} chars): "${h1.text.slice(0, 70)}..."`,
        });
      }
    }

    // Check heading hierarchy (no skipping levels)
    let prevLevel = 0;
    let hierarchyValid = true;
    for (const heading of headings) {
      if (heading.level > prevLevel + 1 && prevLevel > 0) {
        results.warnings.push({
          page: pagePath,
          message: `Heading hierarchy skipped: <h${prevLevel}> followed by <h${heading.level}> ("${heading.text.slice(0, 40)}")`,
        });
        hierarchyValid = false;
      }
      prevLevel = heading.level;
    }

    if (hierarchyValid && headings.length > 0) {
      results.passes.push({ page: pagePath, message: 'Heading hierarchy is correct' });
    }

    // Check empty headings
    for (const heading of headings) {
      if (!heading.text || heading.text.length === 0) {
        results.warnings.push({
          page: pagePath,
          message: `Empty <${heading.tag}> tag found`,
        });
      }
    }
  }

  return results;
}

module.exports = { auditHeadings };
