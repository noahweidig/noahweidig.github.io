// Vendored from https://github.com/noahweidig/seo (astro-seo-audit), MIT licensed.
// See LICENSE-astro-seo-audit.txt in this directory. Do not hand-edit; re-copy
// from upstream and re-run the sed fixups in the vendoring commit if it changes.

'use strict';

const { getRelativePath, getHead, getBody } = require('../utils.cjs');

/**
 * Audit performance-related SEO factors.
 * @param {Array<{filePath: string, html: string}>} pages
 * @param {string} distDir
 * @returns {Object} Audit results.
 */
function auditPerformance(pages, distDir) {
  const results = {
    name: 'Performance',
    passes: [],
    warnings: [],
    errors: [],
  };

  for (const { filePath, html } of pages) {
    const pagePath = getRelativePath(filePath, distDir);
    const head = getHead(html);

    // Check for render-blocking scripts in <head>
    const scriptRegex = /<script\b[^>]*(?:src=["'][^"']+["'])[^>]*>/gi;
    let match;
    let renderBlockingScripts = 0;
    while ((match = scriptRegex.exec(head)) !== null) {
      const tag = match[0];
      const hasDefer = /\bdefer\b/i.test(tag);
      const hasAsync = /\basync\b/i.test(tag);
      const hasModule = /\btype=["']module["']/i.test(tag);

      if (!hasDefer && !hasAsync && !hasModule) {
        renderBlockingScripts++;
        results.errors.push({
          page: pagePath,
          message: `Render-blocking script in <head>: ${truncateTag(tag)}`,
        });
      }
    }

    if (renderBlockingScripts === 0) {
      results.passes.push({ page: pagePath, message: 'No render-blocking scripts in <head>' });
    }

    // Check fonts for display=swap or preload
    const fontLinkRegex = /<link[^>]+(?:fonts|font)[^>]*>/gi;
    while ((match = fontLinkRegex.exec(head)) !== null) {
      const tag = match[0];
      const isPreload = /\brel=["']preload["']/i.test(tag);
      const hasDisplaySwap = /display=swap/i.test(tag) || /font-display:\s*swap/i.test(tag);

      if (!isPreload && !hasDisplaySwap) {
        results.warnings.push({
          page: pagePath,
          message: `Font link without preload or display=swap: ${truncateTag(tag)}`,
        });
      } else {
        results.passes.push({ page: pagePath, message: 'Font properly optimized' });
      }
    }

    // Check for @font-face in inline styles without font-display: swap
    const fontFaceRegex = /@font-face\s*\{[^}]*\}/gi;
    while ((match = fontFaceRegex.exec(html)) !== null) {
      if (!/font-display\s*:\s*swap/i.test(match[0])) {
        results.warnings.push({
          page: pagePath,
          message: '@font-face without font-display: swap',
        });
      }
    }

    // Check inline styles size
    const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
    let totalInlineStyleSize = 0;
    while ((match = styleRegex.exec(html)) !== null) {
      totalInlineStyleSize += match[1].length;
    }

    if (totalInlineStyleSize > 10240) {
      results.warnings.push({
        page: pagePath,
        message: `Inline styles exceed 10KB (${(totalInlineStyleSize / 1024).toFixed(1)}KB)`,
      });
    }

    // Check total HTML size
    const htmlSizeKb = Buffer.byteLength(html, 'utf-8') / 1024;
    if (htmlSizeKb > 100) {
      results.warnings.push({
        page: pagePath,
        message: `Total HTML size exceeds 100KB (${htmlSizeKb.toFixed(1)}KB)`,
      });
    } else {
      results.passes.push({ page: pagePath, message: `HTML size OK (${htmlSizeKb.toFixed(1)}KB)` });
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
  const srcMatch = tag.match(/\bsrc=["']([^"']*)["']/i) || tag.match(/\bhref=["']([^"']*)["']/i);
  if (srcMatch) return srcMatch[1].slice(0, 80);
  return tag.length > 80 ? tag.slice(0, 80) + '...' : tag;
}

module.exports = { auditPerformance };
