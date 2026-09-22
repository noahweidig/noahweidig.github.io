/* ---------------------------------------------------------------- fuzzy -- */
import { basePath, on } from './dom';

/* Pagefind matches whole words, so "wildfre" or "gldilocks" find nothing. The
   title index in /search-index.json is scored character-by-character and fills
   the gap: an exact run of characters is underlined solid, a loose subsequence
   match gets the wavy underline. */
type Doc = { t: string; u: string; s: string; d?: string; g?: string[] };
type Span = { start: number; end: number; exact: boolean };
type Hit = { doc: Doc; score: number; spans: Span[] };

let fuzzyIndex: Doc[] | null = null;
let fuzzyFailed = false;

async function loadIndex(): Promise<Doc[]> {
  if (fuzzyIndex || fuzzyFailed) return fuzzyIndex ?? [];
  try {
    const res = await fetch(`${basePath()}/search-index.json`);
    fuzzyIndex = (await res.json()) as Doc[];
  } catch {
    fuzzyFailed = true;
    fuzzyIndex = [];
  }
  return fuzzyIndex;
}

/** Contiguous run first, scattered subsequence second, nothing third. */
function scoreTerm(term: string, text: string): { score: number; spans: Span[] } | null {
  const hay = text.toLowerCase();
  const at = hay.indexOf(term);
  if (at >= 0) {
    // A hit on a word boundary is worth more than one buried mid-word.
    const boundary = at === 0 || /[^a-z0-9]/.test(hay[at - 1] ?? ' ');
    return {
      score: 100 + term.length * 6 + (boundary ? 30 : 0) - at * 0.4,
      spans: [{ start: at, end: at + term.length, exact: true }],
    };
  }

  let i = 0;
  let gaps = 0;
  let last = -1;
  const spans: Span[] = [];
  for (let c = 0; c < hay.length && i < term.length; c++) {
    if (hay[c] !== term[i]) continue;
    if (last >= 0) gaps += c - last - 1;
    spans.push({ start: c, end: c + 1, exact: false });
    last = c;
    i++;
  }
  if (i < term.length) return null;
  // A subsequence spread across the whole string is a weak match; one that is
  // nearly contiguous is close to a typo'd exact hit.
  return { score: Math.max(4, 46 - gaps * 1.4 - (spans[0]?.start ?? 0) * 0.3), spans };
}

function scoreDoc(query: string, doc: Doc): Hit | null {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return null;
  let total = 0;
  const spans: Span[] = [];
  for (const term of terms) {
    const inTitle = scoreTerm(term, doc.t);
    const elsewhere =
      scoreTerm(term, doc.d ?? '') ?? scoreTerm(term, `${doc.s} ${(doc.g ?? []).join(' ')}`);
    if (!inTitle && !elsewhere) return null;
    if (inTitle) {
      total += inTitle.score;
      spans.push(...inTitle.spans);
    } else if (elsewhere) {
      total += elsewhere.score * 0.35;
    }
  }
  return { doc, score: total / terms.length, spans };
}

const fuzzySearch = (query: string, docs: Doc[], limit: number) =>
  docs
    .map((d) => scoreDoc(query, d))
    .filter((h): h is Hit => h !== null && h.score > 12)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

/** Wraps the scored spans; everything else is escaped as-is. */
function markSpans(text: string, spans: Span[]): string {
  if (!spans.length) return escapeHtml(text);
  const merged = [...spans].sort((a, b) => a.start - b.start);
  let out = '';
  let at = 0;
  for (const s of merged) {
    if (s.start < at) continue;
    out += escapeHtml(text.slice(at, s.start));
    out += `<span class="${s.exact ? 'hit-exact' : 'hit-fuzzy'}">${escapeHtml(
      text.slice(s.start, s.end),
    )}</span>`;
    at = s.end;
  }
  return out + escapeHtml(text.slice(at));
}

/** The same marking for a title Pagefind matched, which returns none of its own. */
const markQuery = (text: string, query: string) => {
  const spans: Span[] = [];
  for (const term of query.toLowerCase().split(/\s+/).filter(Boolean)) {
    const hit = scoreTerm(term, text);
    if (hit) spans.push(...hit.spans);
  }
  return markSpans(text, spans);
};

/* --------------------------------------------------------------- search -- */
type PagefindData = { url: string; meta: Record<string, string>; excerpt: string };
type PagefindResult = { id: string; data: () => Promise<PagefindData> };
type FilterCounts = Record<string, Record<string, number>>;
type Pagefind = {
  search: (
    q: string | null,
    opts?: { filters?: Record<string, string[]> },
  ) => Promise<{ results: PagefindResult[]; filters: FilterCounts }>;
  filters: () => Promise<FilterCounts>;
};

let pagefind: Pagefind | null = null;
let pagefindFailed = false;

async function loadPagefind(): Promise<Pagefind | null> {
  if (pagefind || pagefindFailed) return pagefind;
  try {
    // Indirect so neither TS nor Vite tries to resolve a bundle that only
    // exists after `pagefind --site dist` runs.
    const url = `${basePath()}/pagefind/pagefind.js`;
    pagefind = (await import(/* @vite-ignore */ url)) as unknown as Pagefind;
    return pagefind;
  } catch {
    pagefindFailed = true;
    return null;
  }
}

/**
 * Pagefind already emits URLs carrying the site's base path, so prefixing
 * unconditionally doubled the prefix (/base/base/cv/). Prefix only when it is
 * missing, which keeps this right under any base.
 */
const resultHref = (url: string) => {
  const base = basePath();
  return !base || url.startsWith(`${base}/`) ? url : `${base}${url}`;
};

/** Section first, then tags: the coarse facet reads better at the top. */
const FILTER_ORDER = ['section', 'tag'];
const FILTER_LABEL: Record<string, string> = { section: 'Section', tag: 'Tags' };

export function initSearch() {
  const dialog = document.getElementById('site-search') as HTMLDialogElement | null;
  if (!dialog) return;
  const input = dialog.querySelector<HTMLInputElement>('#search-input');
  const out = dialog.querySelector<HTMLElement>('#search-results');
  const rail = dialog.querySelector<HTMLElement>('#search-filters');
  const groups = dialog.querySelector<HTMLElement>('[data-filter-groups]');
  const toggle = dialog.querySelector<HTMLButtonElement>('[data-filter-toggle]');
  const badge = dialog.querySelector<HTMLElement>('[data-filter-count]');
  const clear = dialog.querySelector<HTMLButtonElement>('[data-filter-clear]');
  const status = dialog.querySelector<HTMLElement>('[data-search-status]');
  if (!input || !out || !rail || !groups || !toggle || !badge || !clear) return;

  const selected: Record<string, Set<string>> = {};
  let active = -1;
  let token = 0;

  const chosen = () => {
    const out: Record<string, string[]> = {};
    for (const [k, v] of Object.entries(selected)) if (v.size) out[k] = [...v];
    return out;
  };
  const chosenCount = () => Object.values(selected).reduce((n, v) => n + v.size, 0);

  /* ---- results list ---- */
  const options = () => Array.from(out.querySelectorAll<HTMLAnchorElement>('[role="option"]'));

  const setActive = (i: number) => {
    const list = options();
    if (!list.length) {
      active = -1;
      input.removeAttribute('aria-activedescendant');
      return;
    }
    active = (i + list.length) % list.length;
    list.forEach((el, n) => {
      const on = n === active;
      el.setAttribute('aria-selected', String(on));
      el.classList.toggle('bg-raised', on);
      if (on) {
        input.setAttribute('aria-activedescendant', el.id);
        el.scrollIntoView({ block: 'nearest' });
      }
    });
  };

  const renderResults = (items: PagefindData[], hits: Hit[], q: string) => {
    /* Trailing slashes trimmed by hand: a `/+$` regex backtracks on a long
       run of them for no gain. */
    const key = (href: string) => {
      let end = href.length;
      while (end > 0 && href[end - 1] === '/') end--;
      return `${href.slice(0, end)}/`;
    };
    const seen = new Set(items.map((d) => key(resultHref(d.url))));

    /* One ranked list rather than two. Pagefind ranks on body text, which puts
       a page whose only tie to the query is a stray initial above the paper the
       reader was actually after; scoring every row's title against the query
       and sorting on that fixes the order without discarding full-text hits. */
    type Row = { href: string; title: string; section: string; sub: string; score: number };

    const rows: Row[] = items.map((d, i) => {
      const title = d.meta.title ?? d.url;
      const titleScore = scoreDoc(q, { t: title, u: d.url, s: d.meta.section ?? '' })?.score ?? 0;
      return {
        href: resultHref(d.url),
        title: markQuery(title, q),
        section: d.meta.section ?? '',
        sub: d.excerpt,
        // A full-text hit is worth something even when the title says nothing.
        score: titleScore + 24 - i * 0.5,
      };
    });

    for (const h of hits) {
      const href = resultHref(h.doc.u);
      if (seen.has(key(href))) continue;
      rows.push({
        href,
        title: markSpans(h.doc.t, h.spans),
        section: h.doc.s,
        sub: escapeHtml(h.doc.d ?? ''),
        score: h.score,
      });
    }

    if (!rows.length) {
      out.innerHTML = `<p class="px-3 py-10 text-center text-sm text-faint">No matches${
        q ? ` for &ldquo;${escapeHtml(q)}&rdquo;` : ''
      }.</p>`;
      setActive(-1);
      return;
    }

    rows.sort((a, b) => b.score - a.score);
    out.innerHTML = rows
      .slice(0, 20)
      .map((r, i) => {
        const chip = r.section ? `<span class="chip shrink-0">${escapeHtml(r.section)}</span>` : '';
        return `<a id="search-opt-${i}" role="option" aria-selected="false" href="${r.href}"
          class="block rounded-md px-3 py-2.5 transition-colors hover:bg-raised">
          <span class="flex items-start justify-between gap-3">
            <span class="text-[0.95rem] font-medium text-ink">${r.title}</span>
            ${chip}
          </span>
          ${r.sub ? `<span class="mt-1 block text-[0.82rem] leading-relaxed text-dim">${r.sub}</span>` : ''}
        </a>`;
      })
      .join('');
    setActive(0);
  };

  /* ---- filter rail ---- */
  const renderFilters = (counts: FilterCounts) => {
    const keys = FILTER_ORDER.filter((k) => counts[k] && Object.keys(counts[k]!).length);
    if (!keys.length) {
      groups.innerHTML = '<p class="text-[0.8rem] text-faint">No filters available.</p>';
      return;
    }
    groups.innerHTML = keys
      .map((key) => {
        const values = Object.entries(counts[key]!)
          // A zero-count value is unreachable from the current query, but one
          // already ticked stays listed so it can be un-ticked.
          .filter(([v, n]) => n > 0 || selected[key]?.has(v))
          .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
        if (!values.length) return '';
        return `<div>
          <h3 class="font-mono text-[0.62rem] tracking-[0.14em] text-faint uppercase">${FILTER_LABEL[key] ?? key}</h3>
          <ul class="mt-2 grid gap-0.5">
            ${values
              .map(([value, n]) => {
                const on = selected[key]?.has(value) ?? false;
                return `<li><button type="button" data-filter-key="${escapeHtml(key)}" data-filter-value="${escapeHtml(value)}"
                  aria-pressed="${on}"
                  class="flex w-full items-center gap-2 rounded px-1.5 py-1 text-left text-[0.8rem] transition-colors hover:bg-line/60 ${
                    on ? 'text-accent-ink' : 'text-dim'
                  }">
                  <span class="grid h-3.5 w-3.5 shrink-0 place-items-center rounded-[3px] border ${
                    on ? 'border-accent bg-accent text-accent-contrast' : 'border-line-strong'
                  }">${on ? '<svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5l10 -10"/></svg>' : ''}</span>
                  <span class="min-w-0 flex-1 truncate">${escapeHtml(value)}</span>
                  <span class="shrink-0 font-mono text-[0.68rem] text-faint">${n}</span>
                </button></li>`;
              })
              .join('')}
          </ul>
        </div>`;
      })
      .join('');
  };

  const syncBadge = () => {
    const n = chosenCount();
    badge.hidden = n === 0;
    badge.textContent = String(n);
    clear.hidden = n === 0;
  };

  /* ---- the one query path ---- */
  const run = async () => {
    const q = input.value.trim();
    const mine = ++token;
    const fuzzyHits = async () => {
      if (!q) return [];
      const docs = (await loadIndex()).filter((d) => {
        const bySection = selected.section?.size ? selected.section.has(d.s) : true;
        const byTag = selected.tag?.size ? (d.g ?? []).some((t) => selected.tag!.has(t)) : true;
        return bySection && byTag;
      });
      return fuzzySearch(q, docs, 8);
    };
    const pf = await loadPagefind();
    if (mine !== token) return;
    if (!pf) {
      // Dev has no Pagefind bundle; the title index still answers most queries.
      const hits = await fuzzyHits();
      if (mine !== token) return;
      renderResults([], hits, q);
      return;
    }

    const filters = chosen();
    const hasFilters = Object.keys(filters).length > 0;
    if (!q && !hasFilters) {
      out.innerHTML =
        '<p class="px-3 py-10 text-center text-sm text-faint">Type to search, or pick a filter.</p>';
      if (status) status.textContent = '';
      renderFilters(await pf.filters());
      syncBadge();
      return;
    }

    // A null query with filters set is Pagefind's "everything matching these
    // facets", which is what an empty box plus a ticked filter should mean.
    const { results, filters: counts } = await pf.search(q || null, { filters });
    if (mine !== token) return;
    const data = await Promise.all(results.slice(0, 20).map((r) => r.data()));
    const hits = data.length >= 12 ? [] : await fuzzyHits();
    if (mine !== token) return;
    renderResults(data, hits, q);
    renderFilters(counts);
    syncBadge();
    if (status) {
      const n = results.length + hits.length;
      status.textContent = `${n} result${n === 1 ? '' : 's'}`;
    }
  };

  /* ---- open / close ---- */
  let lastFocused: HTMLElement | null = null;
  const open = () => {
    lastFocused = document.activeElement as HTMLElement | null;
    if (!dialog.open) dialog.showModal();
    input.focus();
    input.select();
    void run();
  };
  const close = () => {
    if (!dialog.open) return;
    dialog.close();
    lastFocused?.focus();
  };

  document.querySelectorAll('[data-search-open]').forEach((b) => on(b, 'click', open));
  dialog.querySelectorAll('[data-search-close]').forEach((b) => on(b, 'click', close));
  on(dialog, 'click', (ev) => {
    const target = ev.target as HTMLElement;
    if (!target.closest('[data-search-panel]')) close();
  });
  on(document, 'keydown', (ev) => {
    const e = ev as KeyboardEvent;
    if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !isTyping(e.target))) {
      e.preventDefault();
      open();
    }
  });

  /* ---- keyboard ---- */
  on(input, 'keydown', (ev) => {
    const e = ev as KeyboardEvent;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive(active + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive(active - 1);
    } else if (e.key === 'Home' && options().length) {
      e.preventDefault();
      setActive(0);
    } else if (e.key === 'End' && options().length) {
      e.preventDefault();
      setActive(options().length - 1);
    } else if (e.key === 'Enter') {
      const el = options()[active];
      if (el) {
        e.preventDefault();
        el.click();
      }
    }
  });

  let timer: number | undefined;
  on(input, 'input', () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(run, 140);
  });

  /* ---- filter rail wiring ---- */
  const setRail = (openRail: boolean) => {
    rail.hidden = !openRail;
    toggle.setAttribute('aria-expanded', String(openRail));
    if (openRail) void run();
  };
  on(toggle, 'click', () => setRail(rail.hidden));

  on(groups, 'click', (ev) => {
    const btn = (ev.target as HTMLElement).closest<HTMLButtonElement>('[data-filter-key]');
    if (!btn) return;
    const key = btn.dataset.filterKey!;
    const value = btn.dataset.filterValue!;
    const set = (selected[key] ??= new Set());
    if (set.has(value)) set.delete(value);
    else set.add(value);
    void run();
  });

  on(clear, 'click', () => {
    for (const k of Object.keys(selected)) selected[k]!.clear();
    void run();
    input.focus();
  });
}

const isTyping = (t: EventTarget | null) =>
  t instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName);

const escapeHtml = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
