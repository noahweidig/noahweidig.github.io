// Vendored from https://github.com/noahweidig/seo (astro-seo-audit), MIT licensed.
// See LICENSE-astro-seo-audit.txt in this directory. Do not hand-edit; re-copy
// from upstream and re-run the sed fixups in the vendoring commit if it changes.

'use strict';

const { getRelativePath } = require('../utils.cjs');

/**
 * Audit JSON-LD structured data.
 * @param {Array<{filePath: string, html: string}>} pages
 * @param {string} distDir
 * @returns {Object} Audit results.
 */
function auditSchema(pages, distDir) {
  const results = {
    name: 'Schema Markup',
    passes: [],
    warnings: [],
    errors: [],
  };

  for (const { filePath, html } of pages) {
    const pagePath = getRelativePath(filePath, distDir);
    const isHomepage = pagePath === '/index.html' || pagePath === '/';

    // Find all JSON-LD blocks
    const jsonLdBlocks = [];
    const jsonLdRegex = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
    let match;
    while ((match = jsonLdRegex.exec(html)) !== null) {
      jsonLdBlocks.push(match[1]);
    }

    if (jsonLdBlocks.length === 0) {
      results.warnings.push({ page: pagePath, message: 'No JSON-LD structured data found' });
      continue;
    }

    // Validate each JSON-LD block
    const schemaTypes = [];
    for (const block of jsonLdBlocks) {
      try {
        const parsed = JSON.parse(block);
        results.passes.push({ page: pagePath, message: 'JSON-LD is valid JSON' });

        // Collect @type values
        const types = extractTypes(parsed);
        schemaTypes.push(...types);
      } catch (e) {
        results.errors.push({
          page: pagePath,
          message: `Invalid JSON-LD: ${e.message}`,
        });
      }
    }

    // Organization schema on homepage
    if (isHomepage) {
      if (!schemaTypes.includes('Organization') && !schemaTypes.includes('WebSite')) {
        results.warnings.push({
          page: pagePath,
          message: 'Homepage missing Organization or WebSite schema',
        });
      } else {
        results.passes.push({ page: pagePath, message: 'Homepage has Organization/WebSite schema' });
      }
    }

    // BreadcrumbList
    if (!isHomepage && !schemaTypes.includes('BreadcrumbList')) {
      results.warnings.push({
        page: pagePath,
        message: 'Missing BreadcrumbList schema',
      });
    }

    // Blog posts detection
    const isBlogPost = /\/blog\/[^/]+/i.test(pagePath) || /\/posts?\//i.test(pagePath);
    if (isBlogPost && !schemaTypes.includes('BlogPosting') && !schemaTypes.includes('Article')) {
      results.warnings.push({
        page: pagePath,
        message: 'Blog post missing BlogPosting or Article schema',
      });
    }

    // FAQ detection
    const isFaq = /faq/i.test(pagePath) || /<(h[1-6])[^>]*>[^<]*(?:FAQ|Frequently Asked|Preguntas)/i.test(html);
    if (isFaq && !schemaTypes.includes('FAQPage')) {
      results.warnings.push({
        page: pagePath,
        message: 'FAQ content detected but missing FAQPage schema',
      });
    }

    // Service detection
    const isService = /\/servic/i.test(pagePath);
    if (isService && !schemaTypes.includes('Service') && !schemaTypes.includes('Product')) {
      results.warnings.push({
        page: pagePath,
        message: 'Service page missing Service schema',
      });
    }
  }

  return results;
}

/**
 * Recursively extract @type values from a JSON-LD object.
 * @param {*} obj
 * @returns {string[]}
 */
function extractTypes(obj) {
  const types = [];
  if (!obj || typeof obj !== 'object') return types;

  if (Array.isArray(obj)) {
    for (const item of obj) {
      types.push(...extractTypes(item));
    }
    return types;
  }

  if (obj['@type']) {
    if (Array.isArray(obj['@type'])) {
      types.push(...obj['@type']);
    } else {
      types.push(obj['@type']);
    }
  }

  // Check @graph
  if (obj['@graph'] && Array.isArray(obj['@graph'])) {
    for (const item of obj['@graph']) {
      types.push(...extractTypes(item));
    }
  }

  return types;
}

module.exports = { auditSchema };
