// Vendored from https://github.com/noahweidig/seo (astro-seo-audit), MIT licensed.
// See LICENSE-astro-seo-audit.txt in this directory. Do not hand-edit; re-copy
// from upstream and re-run the sed fixups in the vendoring commit if it changes.

'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Recursively find all HTML files in a directory.
 * @param {string} dir - The directory to search.
 * @returns {string[]} Array of absolute file paths.
 */
function findHtmlFiles(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findHtmlFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      results.push(fullPath);
    }
  }
  return results;
}

/**
 * Read a file and return its content as a string.
 * @param {string} filePath - Absolute path to the file.
 * @returns {string} File content.
 */
function readFile(filePath) {
  return fs.readFileSync(filePath, 'utf-8');
}

/**
 * Extract content of a tag using a simple regex.
 * @param {string} html - The HTML string.
 * @param {string} tag - The tag name (e.g., 'title').
 * @returns {string|null} Inner content or null.
 */
function getTagContent(html, tag) {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i');
  const match = html.match(regex);
  return match ? match[1].trim() : null;
}

/**
 * Extract the value of a meta tag by name or property.
 * @param {string} html - The HTML string.
 * @param {string} attr - Attribute name (e.g., 'name', 'property').
 * @param {string} value - Attribute value (e.g., 'description', 'og:title').
 * @returns {string|null} Content value or null.
 */
function getMetaContent(html, attr, value) {
  const regex = new RegExp(
    `<meta[^>]+${attr}=["']${escapeRegex(value)}["'][^>]+content=["']([^"']*)["'][^>]*/?>|<meta[^>]+content=["']([^"']*)["'][^>]+${attr}=["']${escapeRegex(value)}["'][^>]*/?>`,
    'i'
  );
  const match = html.match(regex);
  if (!match) return null;
  return (match[1] || match[2] || '').trim();
}

/**
 * Extract all attributes from matching tags.
 * @param {string} html - The HTML string.
 * @param {string} tagPattern - Regex pattern for the opening tag.
 * @returns {Array<Object>} Array of attribute objects.
 */
function findAllTags(html, tagPattern) {
  const results = [];
  const regex = new RegExp(tagPattern, 'gi');
  let match;
  while ((match = regex.exec(html)) !== null) {
    results.push(match[0]);
  }
  return results;
}

/**
 * Get the relative path from the dist directory.
 * @param {string} filePath - Absolute path.
 * @param {string} distDir - The dist directory root.
 * @returns {string} Relative path starting with /.
 */
function getRelativePath(filePath, distDir) {
  const rel = path.relative(distDir, filePath);
  return '/' + rel.replace(/\\/g, '/');
}

/**
 * Extract the <head> section from HTML.
 * @param {string} html - The HTML string.
 * @returns {string} The head content.
 */
function getHead(html) {
  const match = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
  return match ? match[1] : '';
}

/**
 * Extract the <body> section from HTML.
 * @param {string} html - The HTML string.
 * @returns {string} The body content.
 */
function getBody(html) {
  const match = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  return match ? match[1] : html;
}

/**
 * Escape special regex characters.
 * @param {string} str
 * @returns {string}
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Get the URL path from an HTML file path (e.g., /about/index.html -> /about/).
 * @param {string} filePath - Absolute path to file.
 * @param {string} distDir - The dist directory root.
 * @returns {string} URL path.
 */
function filePathToUrl(filePath, distDir) {
  let rel = getRelativePath(filePath, distDir);
  // /index.html -> /
  // /about/index.html -> /about/
  if (rel.endsWith('/index.html')) {
    rel = rel.slice(0, -10); // remove 'index.html'
  }
  return rel;
}

module.exports = {
  findHtmlFiles,
  readFile,
  getTagContent,
  getMetaContent,
  findAllTags,
  getRelativePath,
  getHead,
  getBody,
  escapeRegex,
  filePathToUrl,
};
