// Vendored from https://github.com/noahweidig/seo (astro-seo-audit), MIT licensed.
// See LICENSE-astro-seo-audit.txt in this directory. Do not hand-edit; re-copy
// from upstream and re-run the sed fixups in the vendoring commit if it changes.

'use strict';

const { getRelativePath, getMetaContent } = require('../utils.cjs');

/**
 * Audit images for SEO best practices.
 * @param {Array<{filePath: string, html: string}>} pages
 * @param {string} distDir
 * @returns {Object} Audit results.
 */
function auditImages(pages, distDir) {
  const results = {
    name: 'Images',
    passes: [],
    warnings: [],
    errors: [],
  };

  for (const { filePath, html } of pages) {
    const pagePath = getRelativePath(filePath, distDir);

    // Find all <img> tags
    const imgRegex = /<img\b[^>]*\/?>/gi;
    const imgs = [];
    let match;
    while ((match = imgRegex.exec(html)) !== null) {
      imgs.push(match[0]);
    }

    if (imgs.length === 0) continue;

    let missingAlt = 0;
    let missingSizing = 0;
    let missingLazy = 0;

    for (const img of imgs) {
      // Check alt attribute
      const hasAlt = /\balt=["'][^"']*["']/i.test(img) || /\balt=""/i.test(img);
      const altMatch = img.match(/\balt=["']([^"']*)["']/i);
      const altValue = altMatch ? altMatch[1] : null;

      if (!hasAlt || altValue === null) {
        missingAlt++;
        results.errors.push({
          page: pagePath,
          message: `Image missing alt attribute: ${truncateTag(img)}`,
        });
      }

      // Check width/height or explicit sizing
      const hasWidth = /\bwidth\s*=/i.test(img);
      const hasHeight = /\bheight\s*=/i.test(img);
      const hasStyle = /\bstyle\s*=/i.test(img);

      if (!hasWidth && !hasHeight && !hasStyle) {
        missingSizing++;
        results.warnings.push({
          page: pagePath,
          message: `Image missing width/height attributes: ${truncateTag(img)}`,
        });
      }

      // Check lazy loading for images that are likely below the fold
      const hasLoading = /\bloading\s*=\s*["']lazy["']/i.test(img);
      const hasDecoding = /\bdecoding\s*=/i.test(img);
      const hasFetchPriority = /\bfetchpriority\s*=\s*["']high["']/i.test(img);

      // Skip LCP candidates (first image, hero images, etc.)
      if (!hasLoading && !hasFetchPriority) {
        missingLazy++;
      }
    }

    if (missingAlt === 0) {
      results.passes.push({ page: pagePath, message: 'All images have alt text' });
    }

    if (missingSizing === 0 && imgs.length > 0) {
      results.passes.push({ page: pagePath, message: 'All images have explicit sizing' });
    }

    if (missingLazy > 2) {
      results.warnings.push({
        page: pagePath,
        message: `${missingLazy} images without lazy loading`,
      });
    }

    // Check for OG image
    const ogImage = getMetaContent(html, 'property', 'og:image');
    if (!ogImage) {
      results.warnings.push({ page: pagePath, message: 'Missing og:image meta tag' });
    }
  }

  return results;
}

/**
 * Truncate a tag string for display.
 * @param {string} tag
 * @returns {string}
 */
function truncateTag(tag) {
  const srcMatch = tag.match(/\bsrc=["']([^"']*)["']/i);
  if (srcMatch) return `<img src="${srcMatch[1].slice(0, 60)}${srcMatch[1].length > 60 ? '...' : ''}">`;
  return tag.length > 80 ? tag.slice(0, 80) + '...' : tag;
}

module.exports = { auditImages };
