import sanitize from "sanitize-html";

export function sanitizeHtml(html) {
  if (!html) return "";
  return sanitize(html, {
    allowedTags: sanitize.defaults.allowedTags.concat(["span", "div"]),
    allowedAttributes: {
      a: ["href", "name", "target", "rel", "class"],
      div: ["class", "style"],
      span: ["class", "style"],
      "*": ["title", "aria-label"],
    },
    allowedStyles: {
      "*": {
        "line-height": [/^[a-zA-Z0-9\-\. %!]+$/],
        "padding-left": [/^[a-zA-Z0-9\-\. %!]+$/],
        "text-indent": [/^[a-zA-Z0-9\-\. %!]+$/],
        "font-style": [/^[a-zA-Z0-9\-\. %!]+$/],
        "font-weight": [/^[a-zA-Z0-9\-\. %!]+$/],
      },
    },
    allowedSchemes: ["http", "https", "mailto"],
    allowProtocolRelative: false,
    transformTags: {
      a: (tagName, attribs) => {
        if (
          attribs.target &&
          !["_self", "_parent", "_top"].includes(attribs.target.toLowerCase())
        ) {
          return {
            tagName: "a",
            attribs: { ...attribs, rel: "noopener noreferrer" },
          };
        }
        return { tagName: "a", attribs };
      },
    },
  });
}

export function stripHtml(html) {
  if (!html) return "";
  return sanitize(html, { allowedTags: [], allowedAttributes: {} })
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
