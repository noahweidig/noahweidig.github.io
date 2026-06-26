import sanitize from "sanitize-html";

export function stripHtml(html) {
  if (!html) return "";
  return sanitize(html, { allowedTags: [], allowedAttributes: {} })
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
