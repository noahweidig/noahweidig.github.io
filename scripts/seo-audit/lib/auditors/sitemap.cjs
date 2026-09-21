// Vendored from https://github.com/noahweidig/seo (astro-seo-audit), MIT licensed.
// See LICENSE-astro-seo-audit.txt in this directory. Do not hand-edit; re-copy
// from upstream and re-run the sed fixups in the vendoring commit if it changes.

'use strict';

const fs = require('fs');
const path = require('path');
const { findHtmlFiles, filePathToUrl } = require('../utils.cjs');

/**
 * Audit sitemap completeness.
 * @param {Array<{filePath: string, html: string}>} pages
 * @param {string} distDir
 * @returns {Object} Audit results.
 */
function auditSitemap(pages, distDir) {
  const results = {
    name: 'Sitemap',
    passes: [],
    warnings: [],
    errors: [],
  };

  // Check for sitemap files
  const sitemapPath = path.join(distDir, 'sitemap.xml');
  const sitemapIndexPath = path.join(distDir, 'sitemap-index.xml');
  const hasSitemap = fs.existsSync(sitemapPath);
  const hasSitemapIndex = fs.existsSync(sitemapIndexPath);

  if (!hasSitemap && !hasSitemapIndex) {
    results.errors.push({
      page: 'sitemap',
      message: 'No sitemap.xml or sitemap-index.xml found in build output',
    });
    return results;
  }

  results.passes.push({
    page: 'sitemap',
    message: hasSitemap ? 'sitemap.xml found' : 'sitemap-index.xml found',
  });

  // Parse sitemap URLs
  let sitemapContent = '';
  const sitemapUrls = new Set();

  if (hasSitemap) {
    sitemapContent = fs.readFileSync(sitemapPath, 'utf-8');
  }
  if (hasSitemapIndex) {
    const indexContent = fs.readFileSync(sitemapIndexPath, 'utf-8');
    // Extract individual sitemap references
    const sitemapRefs = [];
    const locRegex = /<loc>([^<]+)<\/loc>/gi;
    let match;
    while ((match = locRegex.exec(indexContent)) !== null) {
      sitemapRefs.push(match[1]);
    }
    // Try to read child sitemaps that are local files
    for (const ref of sitemapRefs) {
      // Extract filename from URL
      const urlObj = new URL(ref, 'http://localhost');
      const localPath = path.join(distDir, urlObj.pathname);
      if (fs.existsSync(localPath)) {
        sitemapContent += '\n' + fs.readFileSync(localPath, 'utf-8');
      }
    }
  }

  // Extract all URLs from sitemap content
  const locRegex = /<loc>([^<]+)<\/loc>/gi;
  let match;
  while ((match = locRegex.exec(sitemapContent)) !== null) {
    try {
      const urlObj = new URL(match[1], 'http://localhost');
      let pathname = urlObj.pathname;
      // Normalize: ensure trailing slash
      if (!pathname.endsWith('/') && !path.extname(pathname)) {
        pathname += '/';
      }
      sitemapUrls.add(pathname);
    } catch {
      sitemapUrls.add(match[1]);
    }
  }

  // Get all built page URLs
  const builtUrls = new Set();
  for (const { filePath } of pages) {
    const url = filePathToUrl(filePath, distDir);
    builtUrls.add(url);
  }

  // Pages built but not in sitemap
  for (const url of builtUrls) {
    // Normalize for comparison
    const normalized = url.endsWith('/') ? url : url + '/';
    const inSitemap = sitemapUrls.has(url) || sitemapUrls.has(normalized)
      || [...sitemapUrls].some((s) => s.endsWith(url) || s.endsWith(normalized));

    if (!inSitemap) {
      results.warnings.push({
        page: url,
        message: 'Page built but not found in sitemap',
      });
    } else {
      results.passes.push({ page: url, message: 'Page included in sitemap' });
    }
  }

  // Pages in sitemap but not built (orphans)
  for (const sitemapUrl of sitemapUrls) {
    // Skip non-HTML sitemap entries (e.g., other sitemaps)
    if (sitemapUrl.endsWith('.xml')) continue;

    const normalized = sitemapUrl.endsWith('/') ? sitemapUrl : sitemapUrl + '/';
    const isBuilt = builtUrls.has(sitemapUrl) || builtUrls.has(normalized)
      || [...builtUrls].some((b) => sitemapUrl.endsWith(b) || normalized.endsWith(b));

    if (!isBuilt) {
      results.warnings.push({
        page: sitemapUrl,
        message: 'URL in sitemap but no matching built page found (orphan)',
      });
    }
  }

  return results;
}

module.exports = { auditSitemap };
