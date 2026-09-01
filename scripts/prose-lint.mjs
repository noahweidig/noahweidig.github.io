/**
 * prose-lint.mjs — the writing side of the design system (#250).
 *
 * The repo enforces tokens, contrast and markup; nothing checked the prose, so
 * British spellings, Title Case headings next to sentence case ones and
 * agency filler ("let's build something amazing together") all shipped
 * unnoticed. This checks the three rules written down on /styleguide:
 *
 *   1. US English spelling.
 *   2. Sentence case for every heading and every button or link label.
 *   3. Plain, specific, first-person voice — no filler superlatives, no
 *      exclamation marks.
 *
 * It reads .qmd sources rather than rendered HTML, and skips fenced code
 * blocks and inline code: R's `colour =` argument is correct and must stay.
 *
 *   node scripts/prose-lint.mjs [paths...]
 *
 * Vale would cover rule 1 and part of rule 3, but not the mixed-casing
 * problem that prompted this, and it would add a binary download to CI for
 * checks that fit in one dependency-free script. Words that look misspelled
 * but are ours (WUI, terra, GeoPandas, …) live in cspell.json, which runs
 * alongside this in `npm run lint:prose`.
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const config = JSON.parse(fs.readFileSync(path.join(root, "prose.config.json"), "utf8"));

const BRITISH = config.britishSpellings;
const BANNED = config.bannedPhrases;
const PROPER = new Set(config.properNouns.map((w) => w.toLowerCase()));
const SKIP_DIRS = new Set(config.skipDirs);

/** Every .qmd under the repo that is ours to write (Zotero pages are not). */
function collect(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".") || SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collect(full, out);
    else if (entry.name.endsWith(".qmd")) out.push(full);
  }
  return out;
}

/**
 * Blank out the spans no prose rule applies to — fenced code, inline code,
 * HTML attributes and URLs — while keeping every line and column in place, so
 * reported line numbers still point at the source.
 */
function maskCode(src) {
  const lines = src.split("\n");
  let fence = null;
  let htmlFence = false;
  // Front matter is YAML: its `#` comments are not headings, and page titles
  // are entity names (award names, job titles, project names) that are Title
  // Case on purpose. Everything else in it — `description:` above all — is
  // prose the reader sees, so it stays in scope.
  let inFrontMatter = lines[0]?.trim() === "---";
  return lines.map((line, i) => {
    if (inFrontMatter) {
      if (i > 0 && /^---\s*$/.test(line)) {
        inFrontMatter = false;
        return "";
      }
      if (line.trimStart().startsWith("#") || line.startsWith("title:")) return "";
      return line;
    }
    const open = FENCE.exec(line);
    if (fence) {
      if (open && line.trim().startsWith(fence)) {
        fence = null;
        htmlFence = false;
        return "";
      }
      // ```{=html} blocks are the site's markup, not code samples: the home
      // page's headings and buttons live in them.
      return htmlFence ? maskSpans(line) : "";
    }
    if (open) {
      fence = open[1];
      htmlFence = /^\{=html\}/.test(open[2].trim());
      return "";
    }
    return maskSpans(line);
  });
}

/** Inline code, comments and URLs carry no prose. */
function maskSpans(line) {
  return line
    .replace(/`[^`]*`/g, (m) => " ".repeat(m.length))
    .replace(/<!--[^]*?-->/g, (m) => " ".repeat(m.length))
    .replace(/<code\b[^>]*>[^<]*<\/code>/gi, (m) => " ".repeat(m.length))
    .replace(/https?:\/\/\S+/g, (m) => " ".repeat(m.length));
}

/**
 * Attribute values are markup, not prose: `class="nw-btn"` must not trip the
 * spelling and voice rules. The heading and label rules need the attributes
 * intact to find their elements, so only the line-by-line pass masks them.
 */
const maskAttributes = (line) => line.replaceAll(HTML_ATTR, (m) => " ".repeat(m.length));

// Declared once: each is used per line of every file.
const FENCE = /^[ \t]{0,3}(`{3,}|~{3,})[ \t]*(.*)$/;
const ATX_HEADING = /^[ \t]{0,3}#{1,6}[ \t]+(.*)$/;
const ATX_ATTRS = /\{[^{}]*\}[ \t]*$/;
const HTML_ATTR = /[\w-]+="[^"]*"/g;
const CLASS_ATTR = /class="([^"]*)"/;

const problems = [];
const flag = (file, lineNo, rule, message) =>
  problems.push({ file: path.relative(root, file), line: lineNo, rule, message });

const TITLE_CASE_EXEMPT = /^[A-Z0-9&/.'’-]+$/; // acronyms, numbers, "R&D"

/** Words after the first that are capitalised without being proper nouns. */
function titleCaseOffenders(text) {
  // Product and organization names keep their own capitalization ("Shift Your
  // Phone"), so they are removed before the rule looks at what is left.
  for (const phrase of config.properNounPhrases) text = text.split(phrase).join(" ");
  const words = text
    .replace(/&[a-z]+;/g, " ")
    .replace(/[^\p{L}\p{N}&/.'’-]+/gu, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const bad = [];
  for (const [i, word] of words.entries()) {
    if (i === 0) continue;
    if (!/^[A-Z][a-z]/.test(word)) continue; // ALLCAPS and lowercase are fine
    if (TITLE_CASE_EXEMPT.test(word)) continue;
    if (PROPER.has(word.toLowerCase().replaceAll(/[.,:;]/g, ""))) continue;
    // "U.S." style and hyphenated proper nouns ("Wildland-Urban") are checked
    // piecewise so "Wildland-Urban Interface" still needs its allowlist entry.
    bad.push(word);
  }
  return bad;
}

function checkLabel(file, lineNo, kind, text) {
  const clean = text
    .replace(/<[^>]*>/g, " ")
    .replace(/[↓→←↑]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!clean) return;
  const bad = titleCaseOffenders(clean);
  if (bad.length) {
    flag(
      file,
      lineNo,
      "sentence-case",
      `${kind} "${clean}" uses Title Case (${bad.join(", ")}) — sentence case, please.`,
    );
  }
}

// Headings and labels live in two shapes: Markdown ATX headings, and the raw
// HTML blocks the home page is built from.
// h1 is the page's own display line and h4+ are card titles — entity names
// (a job title, a degree, a person) that are Title Case on purpose. Section
// headings are h2/h3, either bare or carrying one of the section classes.
const HTML_HEADING = /<h([23])\b([^>]*)>([\s\S]*?)<\/h\2?[23]>/gi;
const LABELLED = new RegExp(
  String.raw`<(a|button|span)\b[^>]*class="[^"]*\b(?:${config.labelClasses.join("|")})\b[^"]*"[^>]*>([^]*?)</\1>`,
  "gi",
);

function checkFile(file) {
  const src = fs.readFileSync(file, "utf8");
  const masked = maskCode(src);

  masked.forEach((rawLine, i) => {
    const line = maskAttributes(rawLine);
    const lineNo = i + 1;
    for (const [wrong, right] of Object.entries(BRITISH)) {
      if (new RegExp(String.raw`\b${wrong}\b`, "i").test(line)) {
        flag(file, lineNo, "us-spelling", `"${wrong}" is the British form — use "${right}".`);
      }
    }
    for (const phrase of BANNED) {
      if (new RegExp(String.raw`\b${phrase}\b`, "i").test(line)) {
        flag(file, lineNo, "voice", `"${phrase}" is filler — say the specific thing instead.`);
      }
    }
    // Exclamation marks in prose only: JS negation and CSS !important live in
    // masked spans already, and YAML front matter is prose we write too.
    if (/!(?=\s|$|["'”’)])/.test(line.replace(/<[^>]*>/g, " "))) {
      flag(file, lineNo, "voice", "Exclamation mark — the site's voice is plain and specific.");
    }
    const atx = ATX_HEADING.exec(line);
    // Pandoc heading attributes ("## Awards {#sec-awards}") are markup.
    const heading = atx?.[1].replace(ATX_ATTRS, "").trim();
    if (heading) checkLabel(file, lineNo, "Heading", heading);
  });

  // Multi-line HTML: match on the whole (masked) document, then map the offset
  // back to a line number.
  const doc = masked.join("\n");
  const lineOf = (index) => doc.slice(0, index).split("\n").length;
  for (const m of doc.matchAll(HTML_HEADING)) {
    const classes = (CLASS_ATTR.exec(m[2])?.[1] ?? "").split(/[ \t]+/).filter(Boolean);
    if (classes.length && !classes.some((c) => config.headingClasses.includes(c))) continue;
    checkLabel(file, lineOf(m.index), "Heading", m[3]);
  }
  for (const m of doc.matchAll(LABELLED)) checkLabel(file, lineOf(m.index), "Label", m[2]);
}

const targets = process.argv.slice(2).length
  ? process.argv.slice(2).map((p) => path.resolve(p))
  : collect(root);

for (const file of targets) checkFile(file);

if (!problems.length) {
  console.log(`[prose] ${targets.length} files checked, no issues.`);
  process.exit(0);
}
for (const p of problems) {
  console.error(`${p.file}:${p.line}  ${p.rule}  ${p.message}`);
}
console.error(`\n[prose] ${problems.length} issue(s).`);
process.exit(1);
