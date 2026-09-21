// Vendored from https://github.com/noahweidig/seo (astro-seo-audit), MIT licensed.
// See LICENSE-astro-seo-audit.txt in this directory. Do not hand-edit; re-copy
// from upstream and re-run the sed fixups in the vendoring commit if it changes.

'use strict';

const { getTagContent, getMetaContent, getRelativePath } = require('../utils.cjs');

/**
 * Audit meta tags across all pages.
 * @param {Array<{filePath: string, html: string}>} pages
 * @param {string} distDir
 * @returns {Object} Audit results.
 */
function auditMetaTags(pages, distDir) {
  const results = {
    name: 'Meta Tags',
    passes: [],
    warnings: [],
    errors: [],
  };

  const titles = new Map();
  const descriptions = new Map();

  for (const { filePath, html } of pages) {
    const pagePath = getRelativePath(filePath, distDir);

    // Title
    const title = getTagContent(html, 'title');
    if (!title) {
      results.errors.push({ page: pagePath, message: 'Missing <title> tag' });
    } else if (title.length > 60) {
      results.warnings.push({
        page: pagePath,
        message: `Title too long (${title.length} chars, max 60): "${title.slice(0, 60)}..."`,
      });
    } else {
      results.passes.push({ page: pagePath, message: 'Title present and within limit' });
    }

    // Track duplicates
    if (title) {
      if (!titles.has(title)) titles.set(title, []);
      titles.get(title).push(pagePath);
    }

    // Meta description
    const description = getMetaContent(html, 'name', 'description');
    if (!description) {
      results.errors.push({ page: pagePath, message: 'Missing meta description' });
    } else if (description.length > 155) {
      results.warnings.push({
        page: pagePath,
        message: `Meta description too long (${description.length} chars, max 155)`,
      });
    } else {
      results.passes.push({ page: pagePath, message: 'Meta description present and within limit' });
    }

    if (description) {
      if (!descriptions.has(description)) descriptions.set(description, []);
      descriptions.get(description).push(pagePath);
    }

    // Canonical URL
    const canonicalMatch = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']*)["'][^>]*\/?>/i)
      || html.match(/<link[^>]+href=["']([^"']*)["'][^>]+rel=["']canonical["'][^>]*\/?>/i);
    if (!canonicalMatch) {
      results.errors.push({ page: pagePath, message: 'Missing canonical URL' });
    } else {
      results.passes.push({ page: pagePath, message: 'Canonical URL set' });
    }

    // OG tags
    const ogTitle = getMetaContent(html, 'property', 'og:title');
    const ogDescription = getMetaContent(html, 'property', 'og:description');
    const ogImage = getMetaContent(html, 'property', 'og:image');
    const ogUrl = getMetaContent(html, 'property', 'og:url');

    if (!ogTitle) results.errors.push({ page: pagePath, message: 'Missing og:title' });
    if (!ogDescription) results.errors.push({ page: pagePath, message: 'Missing og:description' });
    if (!ogImage) results.warnings.push({ page: pagePath, message: 'Missing og:image' });
    if (!ogUrl) results.warnings.push({ page: pagePath, message: 'Missing og:url' });
    if (ogTitle && ogDescription) {
      results.passes.push({ page: pagePath, message: 'OG tags present' });
    }

    // Twitter card
    const twitterCard = getMetaContent(html, 'name', 'twitter:card')
      || getMetaContent(html, 'property', 'twitter:card');
    if (!twitterCard) {
      results.warnings.push({ page: pagePath, message: 'Missing twitter:card meta tag' });
    } else {
      results.passes.push({ page: pagePath, message: 'Twitter card meta tag present' });
    }
  }

  // Check for duplicate titles
  for (const [title, pagePaths] of titles) {
    if (pagePaths.length > 1) {
      results.warnings.push({
        page: pagePaths.join(', '),
        message: `Duplicate title: "${title}"`,
      });
    }
  }

  // Check for duplicate descriptions
  for (const [desc, pagePaths] of descriptions) {
    if (pagePaths.length > 1) {
      results.warnings.push({
        page: pagePaths.join(', '),
        message: `Duplicate meta description: "${desc.slice(0, 50)}..."`,
      });
    }
  }

  return results;
}

module.exports = { auditMetaTags };
