/**
 * Site behaviour: theme toggle, sticky header, mobile menu, scroll reveal,
 * pointer-tracked card glow, filter bars, tabs, marquee cloning and the
 * Pagefind search dialog. Everything re-binds on `astro:page-load` so it
 * survives client-side navigations.
 */

/** The site's base path, read off the document rather than import.meta.env so
    this module stays a plain script. */
const basePath = () => (document.documentElement.dataset.base ?? '').replace(/\/+$/, '');

type Cleanup = () => void;
let cleanups: Cleanup[] = [];

const on = <K extends keyof DocumentEventMap>(
  el: EventTarget,
  type: K | string,
  fn: EventListenerOrEventListenerObject,
  opts?: AddEventListenerOptions,
) => {
  el.addEventListener(type, fn, opts);
  cleanups.push(() => el.removeEventListener(type, fn, opts));
};

/* ---------------------------------------------------------------- theme -- */
type ThemePref = 'light' | 'dark' | 'system';
const THEME_ORDER: ThemePref[] = ['light', 'dark', 'system'];

function resolveTheme(pref: ThemePref): 'light' | 'dark' {
  if (pref === 'system') {
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  return pref;
}

function applyTheme(pref: ThemePref) {
  const theme = resolveTheme(pref);
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.themePref = pref;
  try {
    localStorage.setItem('nw-theme', pref);
  } catch {
    /* private mode — the in-page toggle still works for this session */
  }
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', theme === 'light' ? '#fbfaf7' : '#07080b');
}

function initTheme() {
  document.querySelectorAll<HTMLButtonElement>('[data-theme-toggle]').forEach((btn) => {
    on(btn, 'click', () => {
      const current = (document.documentElement.dataset.themePref as ThemePref) ?? 'system';
      const next = THEME_ORDER[(THEME_ORDER.indexOf(current) + 1) % THEME_ORDER.length];
      applyTheme(next);
    });
  });

  // Live-update while following the OS, so an open tab doesn't need a reload
  // or a click to pick up a change in system theme.
  on(window.matchMedia('(prefers-color-scheme: light)'), 'change', () => {
    if (document.documentElement.dataset.themePref === 'system') applyTheme('system');
  });
}

/* --------------------------------------------------------------- header -- */
function initHeader() {
  const header = document.getElementById('site-header');
  if (!header) return;
  const sync = () => header.toggleAttribute('data-stuck', window.scrollY > 8);
  sync();
  on(window, 'scroll', sync, { passive: true } as AddEventListenerOptions);

  const toggle = document.querySelector<HTMLButtonElement>('[data-menu-toggle]');
  const panel = document.getElementById('mobile-nav');
  if (!toggle || !panel) return;
  const openIcon = toggle.querySelector('[data-menu-icon-open]');
  const closeIcon = toggle.querySelector('[data-menu-icon-close]');
  const setOpen = (open: boolean) => {
    panel.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    openIcon?.toggleAttribute('hidden', open);
    closeIcon?.toggleAttribute('hidden', !open);
  };
  on(toggle, 'click', () => setOpen(panel.hidden));
  panel.querySelectorAll('a').forEach((a) => on(a, 'click', () => setOpen(false)));
  on(window, 'resize', () => {
    if (window.innerWidth >= 1024) setOpen(false);
  });
}

/* --------------------------------------------------------------- reveal -- */
function initReveal() {
  const items = document.querySelectorAll<HTMLElement>('[data-reveal]');
  if (!items.length) return;
  if (!('IntersectionObserver' in window)) {
    items.forEach((el) => el.classList.add('is-in'));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        (e.target as HTMLElement).classList.add('is-in');
        io.unobserve(e.target);
      });
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.06 },
  );
  items.forEach((el) => io.observe(el));
  cleanups.push(() => io.disconnect());
}

/* ----------------------------------------------------------- card glow -- */
function initGlow() {
  const cards = document.querySelectorAll<HTMLElement>('.card-hover');
  if (!cards.length || window.matchMedia('(hover: none)').matches) return;
  cards.forEach((card) => {
    on(card, 'pointermove', (ev) => {
      const e = ev as PointerEvent;
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${((e.clientX - r.left) / r.width) * 100}%`);
      card.style.setProperty('--my', `${((e.clientY - r.top) / r.height) * 100}%`);
    });
  });
}

/* -------------------------------------------------------------- marquee -- */
function initMarquees() {
  const tracks = Array.from(document.querySelectorAll<HTMLElement>('[data-marquee]'));
  if (!tracks.length) return;

  // The track is animated with a transform, so an icon that starts off-screen
  // never satisfies a native lazy load — the browser sees it parked outside the
  // viewport and leaves it there. Loading the whole strip when the strip itself
  // scrolls into view keeps those ~270 KB off the initial page load.
  const fill = (track: HTMLElement) => {
    track.querySelectorAll<HTMLImageElement>('img[data-src]').forEach((img) => {
      img.src = img.dataset.src!;
      delete img.dataset.src;
    });
    track.querySelectorAll<HTMLElement>('[data-mask-src]').forEach((el) => {
      const src = el.dataset.maskSrc!;
      el.style.maskImage = `url(${src})`;
      el.style.setProperty('-webkit-mask-image', `url(${src})`);
      delete el.dataset.maskSrc;
    });
    if (track.dataset.cloned !== 'true') {
      track.append(...Array.from(track.children).map((c) => c.cloneNode(true)));
      track.dataset.cloned = 'true';
    }
  };

  if (!('IntersectionObserver' in window)) {
    tracks.forEach(fill);
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        fill(e.target as HTMLElement);
        io.unobserve(e.target);
      });
    },
    { rootMargin: '200px 0px' },
  );
  tracks.forEach((t) => io.observe(t));
  cleanups.push(() => io.disconnect());
}

/* -------------------------------------------------------------- filters -- */
function initFilters() {
  document.querySelectorAll<HTMLElement>('[data-filter-bar]').forEach((bar) => {
    const targetSel = bar.dataset.filterFor;
    if (!targetSel) return;
    const noun = bar.dataset.filterNoun ?? 'items';
    const scopes = Array.from(document.querySelectorAll<HTMLElement>(targetSel));
    const items = scopes.flatMap((s) => Array.from(s.querySelectorAll<HTMLElement>('[data-cats]')));
    const count = bar.querySelector<HTMLElement>('[data-filter-count]');

    const setActive = (value: string) => {
      bar.querySelectorAll<HTMLButtonElement>('button[data-filter]').forEach((b) => {
        b.setAttribute('aria-pressed', String(b.dataset.filter === value));
      });
      let shown = 0;
      items.forEach((item) => {
        const cats = (item.dataset.cats ?? '').split('|').filter(Boolean);
        const match = value === '*' || cats.includes(value);
        item.hidden = !match;
        if (match) shown++;
      });
      scopes.forEach((s) => {
        const any = Array.from(s.querySelectorAll<HTMLElement>('[data-cats]')).some(
          (i) => !i.hidden,
        );
        const section = s.closest<HTMLElement>('[data-filter-section]') ?? s;
        section.hidden = !any;
      });
      if (count) count.textContent = `${shown} ${shown === 1 ? noun.replace(/s$/, '') : noun}`;
      const url = new URL(location.href);
      if (value === '*') url.searchParams.delete('filter');
      else url.searchParams.set('filter', value);
      history.replaceState(history.state, '', url);
    };

    bar.querySelectorAll<HTMLButtonElement>('button[data-filter]').forEach((b) => {
      on(b, 'click', () => setActive(b.dataset.filter!));
    });

    const initial = new URL(location.href).searchParams.get('filter');
    const known = Array.from(bar.querySelectorAll<HTMLButtonElement>('button[data-filter]')).map(
      (b) => b.dataset.filter,
    );
    setActive(initial && known.includes(initial) ? initial : '*');
  });
}

/* ----------------------------------------------------------------- tabs -- */
function initTabs() {
  document.querySelectorAll<HTMLElement>('[data-tabs]').forEach((root) => {
    const tabs = Array.from(root.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
    const strip = root.querySelector<HTMLElement>('[role="tablist"]');
    if (!tabs.length || !strip) return;
    strip.hidden = false;

    const select = (index: number, focus = false) => {
      tabs.forEach((tab, i) => {
        const selected = i === index;
        tab.setAttribute('aria-selected', String(selected));
        tab.tabIndex = selected ? 0 : -1;
        const panel = document.getElementById(tab.getAttribute('aria-controls') ?? '');
        if (panel) panel.hidden = !selected;
      });
      if (focus) tabs[index]?.focus();
    };

    tabs.forEach((tab, i) => {
      on(tab, 'click', () => select(i));
      on(tab, 'keydown', (ev) => {
        const e = ev as KeyboardEvent;
        const delta = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (!delta) return;
        e.preventDefault();
        select((i + delta + tabs.length) % tabs.length, true);
      });
    });
    select(0);
  });
}

/* ---------------------------------------------------------------- fuzzy -- */
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

function initSearch() {
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
  const open = () => {
    if (!dialog.open) dialog.showModal();
    input.focus();
    input.select();
    void run();
  };
  const close = () => dialog.open && dialog.close();

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

/* ------------------------------------------------------------ typewriter -- */
function initTypewriter() {
  const el = document.querySelector<HTMLElement>('[data-typed]');
  if (!el) return;
  let words: string[];
  try {
    words = JSON.parse(el.dataset.typed ?? '[]');
  } catch {
    return;
  }
  if (!words.length) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    el.textContent = words[0]!;
    return;
  }
  let w = 0;
  let c = 0;
  let deleting = false;
  let timer: number;
  const tick = () => {
    const word = words[w]!;
    c += deleting ? -1 : 1;
    el.textContent = word.slice(0, c);
    let delay = deleting ? 34 : 68;
    if (!deleting && c === word.length) {
      delay = 1800;
      deleting = true;
    } else if (deleting && c === 0) {
      deleting = false;
      w = (w + 1) % words.length;
      delay = 320;
    }
    timer = window.setTimeout(tick, delay);
  };
  timer = window.setTimeout(tick, 600);
  cleanups.push(() => window.clearTimeout(timer));
}

/* ---------------------------------------------------------- code blocks -- */
const COPY_ICON =
  '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>';
const CHECK_ICON =
  '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';

function initCodeCopy() {
  const blocks = document.querySelectorAll<HTMLPreElement>('.prose-nw pre');
  blocks.forEach((pre) => {
    if (pre.parentElement?.dataset.codeBlock === 'true') return;

    // Wrapped rather than positioned on the <pre> itself: the <pre> scrolls
    // horizontally, and a button inside it would scroll away with the code.
    const wrap = document.createElement('div');
    wrap.dataset.codeBlock = 'true';
    wrap.className = 'relative';
    pre.replaceWith(wrap);
    wrap.appendChild(pre);

    // Icon only — the word "Copy" sat over the first line of code. The label
    // it replaces comes back as a tooltip on hover.
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'code-copy';
    btn.innerHTML = COPY_ICON;
    btn.dataset.tip = 'Copy';
    btn.setAttribute('aria-label', 'Copy code to clipboard');

    on(btn, 'click', async () => {
      let tip = 'Copied';
      try {
        await navigator.clipboard.writeText(pre.innerText.replace(/\n$/, ''));
        btn.innerHTML = CHECK_ICON;
      } catch {
        // Clipboard blocked (insecure context, or a permissions policy): the
        // code is still selectable, so say what happened rather than lie.
        tip = 'Select it and copy';
      }
      btn.dataset.tip = tip;
      showTip(btn);
      window.setTimeout(() => {
        btn.innerHTML = COPY_ICON;
        btn.dataset.tip = 'Copy';
        hideTip();
      }, 1600);
    });

    wrap.appendChild(btn);
  });
}

/* ------------------------------------------------------- heading anchors -- */
/* A copy-the-anchor control per heading: hovering a heading reveals a #, and
   clicking it copies the full URL rather than only moving the hash. */
function initHeadingAnchors() {
  document
    .querySelectorAll<HTMLHeadingElement>('.prose-nw h2[id], .prose-nw h3[id], .prose-nw h4[id]')
    .forEach((h) => {
      if (h.querySelector('.heading-anchor')) return;
      const a = document.createElement('a');
      a.className = 'heading-anchor';
      a.href = `#${h.id}`;
      a.dataset.tip = 'Copy link to this section';
      a.setAttribute('aria-label', `Copy link to section: ${h.textContent?.trim() ?? h.id}`);
      a.innerHTML =
        '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9h16"/><path d="M4 15h16"/><path d="M10 3 8 21"/><path d="M16 3l-2 18"/></svg>';

      on(a, 'click', async (ev) => {
        ev.preventDefault();
        const url = `${location.origin}${location.pathname}#${h.id}`;
        history.replaceState(history.state, '', `#${h.id}`);
        h.scrollIntoView({ behavior: 'smooth', block: 'start' });
        try {
          await navigator.clipboard.writeText(url);
          a.dataset.tip = 'Link copied';
        } catch {
          a.dataset.tip = 'Copy blocked — the link is in the address bar';
        }
        showTip(a);
        window.setTimeout(() => {
          a.dataset.tip = 'Copy link to this section';
          hideTip();
        }, 1600);
      });

      h.prepend(a);
    });
}

/* ---------------------------------------------------------- reading mode -- */
/* Strips the page back to the article: rails, share row, comments and footer
   step out and the measure grows. The choice is remembered per reader. */
function initReadingMode() {
  const btn = document.querySelector<HTMLButtonElement>('[data-reading-toggle]');
  if (!btn) return;
  const root = document.documentElement;

  const set = (on_: boolean) => {
    if (on_) root.dataset.reading = '';
    else delete root.dataset.reading;
    btn.setAttribute('aria-pressed', String(on_));
    btn.dataset.tip = on_ ? 'Leave reading mode' : 'Reading mode: just the article';
    const label = btn.querySelector('[data-reading-label]');
    if (label) label.textContent = on_ ? 'Exit reading mode' : 'Reading mode';
  };

  let stored: string | null = null;
  try {
    stored = localStorage.getItem('nw-reading');
  } catch {
    /* private mode — the toggle still works for this page */
  }
  set(stored === 'on');

  on(btn, 'click', () => {
    const next = root.dataset.reading === undefined;
    set(next);
    try {
      localStorage.setItem('nw-reading', next ? 'on' : 'off');
    } catch {
      /* nothing to persist to */
    }
  });

  // The attribute lives on <html>, which survives a view-transition swap; a
  // reader who left reading mode on one post should not find it on the next.
  cleanups.push(() => {
    if (!document.querySelector('[data-reading-toggle]')) delete root.dataset.reading;
  });
}

/* --------------------------------------------------------------- tooltip -- */
/* One floating element for the whole page: an ancestor with overflow hidden
   would clip a tooltip rendered inside the trigger. */
let tipEl: HTMLElement | null = null;
let tipTimer: number | undefined;

const tipRoot = () => {
  if (!tipEl?.isConnected) {
    tipEl = document.createElement('div');
    tipEl.className = 'nw-tip';
    tipEl.setAttribute('role', 'tooltip');
    document.body.appendChild(tipEl);
  }
  return tipEl;
};

function showTip(target: HTMLElement) {
  const text = target.dataset.tip;
  if (!text) return;
  const el = tipRoot();
  const title = target.dataset.tipTitle;
  el.innerHTML = title
    ? `<b>${escapeHtml(title)}</b><span>${escapeHtml(text)}</span>`
    : escapeHtml(text);
  el.style.visibility = 'hidden';
  el.dataset.show = '';

  const r = target.getBoundingClientRect();
  const t = el.getBoundingClientRect();
  const margin = 8;
  let left = r.left + r.width / 2 - t.width / 2;
  left = Math.max(margin, Math.min(left, window.innerWidth - t.width - margin));
  // Above the trigger where there is room, below it otherwise.
  const above = r.top > t.height + margin * 2;
  const top = above ? r.top - t.height - margin : r.bottom + margin;
  el.style.left = `${Math.round(left)}px`;
  el.style.top = `${Math.round(top)}px`;
  el.style.visibility = '';
}

function hideTip() {
  window.clearTimeout(tipTimer);
  if (tipEl) delete tipEl.dataset.show;
}

function initTooltips() {
  const enter = (ev: Event) => {
    const target = (ev.target as HTMLElement | null)?.closest<HTMLElement>('[data-tip]');
    if (!target) return;
    window.clearTimeout(tipTimer);
    tipTimer = window.setTimeout(() => showTip(target), 140);
  };
  const leave = (ev: Event) => {
    const target = (ev.target as HTMLElement | null)?.closest<HTMLElement>('[data-tip]');
    if (target) hideTip();
  };

  // Pointer tooltips only where there is a pointer to hover with; the focus
  // pair is bound either way, so a keyboard reader still gets the label.
  if (!window.matchMedia('(hover: none)').matches) {
    on(document, 'pointerover', enter);
    on(document, 'pointerout', leave);
  }
  on(document, 'focusin', enter);
  on(document, 'focusout', leave);
  on(window, 'scroll', hideTip, { passive: true } as AddEventListenerOptions);
  on(document, 'keydown', (ev) => {
    if ((ev as KeyboardEvent).key === 'Escape') hideTip();
  });
  cleanups.push(hideTip);
}

/* -------------------------------------------------------------- lightbox -- */
/* A custom viewer rather than a library: it inherits the site's surfaces and
   the whole thing is one dialog-less overlay with keyboard paging. */
function initLightbox() {
  const shots = Array.from(
    document.querySelectorAll<HTMLImageElement>(
      '.prose-nw img:not([data-no-zoom]), [data-zoomable] img, img[data-zoomable]',
    ),
  ).filter((img) => !img.closest('a'));
  if (!shots.length) return;

  shots.forEach((img, i) => {
    img.classList.add('zoomable');
    img.dataset.zoomIndex = String(i);
    img.dataset.tip ??= 'Click to enlarge';
    if (!img.hasAttribute('tabindex')) img.tabIndex = 0;
    img.setAttribute('role', 'button');
  });

  let box: HTMLElement | null = null;
  let index = 0;

  const captionFor = (img: HTMLImageElement) =>
    img.closest('figure')?.querySelector('figcaption')?.textContent?.trim() || img.alt || '';

  const paint = () => {
    if (!box) return;
    const img = shots[index]!;
    const full = box.querySelector<HTMLImageElement>('[data-lightbox-img]')!;
    full.src = img.currentSrc || img.src;
    full.alt = img.alt;
    box.querySelector('[data-lightbox-caption]')!.textContent = captionFor(img);
    box.querySelector('[data-lightbox-count]')!.textContent =
      shots.length > 1 ? `${index + 1} / ${shots.length}` : '';
  };

  const close = () => {
    if (!box) return;
    const node = box;
    box = null;
    delete node.dataset.show;
    document.body.style.removeProperty('overflow');
    window.setTimeout(() => node.remove(), 220);
    shots[index]?.focus();
  };

  const step = (delta: number) => {
    index = (index + delta + shots.length) % shots.length;
    paint();
  };

  const open = (i: number) => {
    index = i;
    box = document.createElement('div');
    box.className = 'lightbox';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-label', 'Image viewer');
    box.innerHTML = `
      <div class="lightbox-bar">
        <span data-lightbox-count class="font-mono text-[0.7rem] tracking-[0.14em] uppercase"></span>
        <span class="ml-auto flex items-center gap-2">
          ${
            shots.length > 1
              ? `<button type="button" class="icon-tile" data-lightbox-prev aria-label="Previous image" data-tip="Previous (←)"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg></button>
                 <button type="button" class="icon-tile" data-lightbox-next aria-label="Next image" data-tip="Next (→)"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg></button>`
              : ''
          }
          <button type="button" class="icon-tile" data-lightbox-close aria-label="Close viewer" data-tip="Close (Esc)"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></button>
        </span>
      </div>
      <div class="lightbox-stage" data-lightbox-stage><img data-lightbox-img alt="" /></div>
      <p class="lightbox-caption" data-lightbox-caption></p>`;
    document.body.appendChild(box);
    document.body.style.overflow = 'hidden';
    paint();
    requestAnimationFrame(() => {
      if (box) box.dataset.show = '';
    });
    box.querySelector<HTMLButtonElement>('[data-lightbox-close]')?.focus();

    box.addEventListener('click', (ev) => {
      const el = ev.target as HTMLElement;
      if (el.closest('[data-lightbox-close]') || el.dataset.lightboxStage !== undefined) close();
      else if (el.closest('[data-lightbox-prev]')) step(-1);
      else if (el.closest('[data-lightbox-next]')) step(1);
    });
  };

  shots.forEach((img, i) => {
    on(img, 'click', () => open(i));
    on(img, 'keydown', (ev) => {
      const k = (ev as KeyboardEvent).key;
      if (k === 'Enter' || k === ' ') {
        ev.preventDefault();
        open(i);
      }
    });
  });

  on(document, 'keydown', (ev) => {
    if (!box) return;
    const k = (ev as KeyboardEvent).key;
    if (k === 'Escape') close();
    else if (k === 'ArrowLeft') step(-1);
    else if (k === 'ArrowRight') step(1);
    else if (k === 'Tab') {
      // Nothing else on the page should be reachable while the overlay is up.
      const focusable = Array.from(
        box.querySelectorAll<HTMLElement>('button, [href], [tabindex]:not([tabindex="-1"])'),
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;
      const shiftKey = (ev as KeyboardEvent).shiftKey;
      if (shiftKey && document.activeElement === first) {
        ev.preventDefault();
        last.focus();
      } else if (!shiftKey && document.activeElement === last) {
        ev.preventDefault();
        first.focus();
      }
    }
  });

  cleanups.push(() => {
    if (box) close();
  });
}

/* ------------------------------------------------------------ back to top -- */
/* Only appears while the reader is actively scrolling up, and only past a
   fold's worth of scroll — so it never fights a page that's still scrolling
   down, and never shows up right at the top where it would have nothing to
   do. */
function initBackToTop() {
  const btn = document.getElementById('back-to-top');
  if (!btn) return;
  const threshold = window.innerHeight * 0.75;
  let lastY = window.scrollY;

  const sync = () => {
    const y = window.scrollY;
    const scrollingUp = y < lastY;
    btn.toggleAttribute('data-show', scrollingUp && y > threshold);
    lastY = y;
  };
  sync();
  on(window, 'scroll', sync, { passive: true } as AddEventListenerOptions);

  on(btn, 'click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

/* ------------------------------------------------------------------ toc -- */
/* On mobile the rail has no column, so it is a popover behind a floating
   button; the desktop rail is the same markup with the popover CSS undone. */
function initTocFab() {
  const fab = document.querySelector<HTMLElement>('[data-toc-fab]');
  const aside = document.querySelector<HTMLElement>('[data-toc-aside]');
  if (!fab || !aside) return;

  const setOpen = (open: boolean) => {
    aside.toggleAttribute('data-open', open);
    fab.setAttribute('aria-expanded', String(open));
  };

  on(fab, 'click', (e) => {
    e.stopPropagation();
    setOpen(!aside.hasAttribute('data-open'));
  });
  on(aside, 'click', (e) => {
    if ((e.target as HTMLElement).closest('a')) setOpen(false);
  });
  on(document, 'click', (e) => {
    if (!aside.contains(e.target as Node)) setOpen(false);
  });
  on(document, 'keydown', (e) => {
    if ((e as KeyboardEvent).key === 'Escape') setOpen(false);
  });
}

function initToc() {
  initTocFab();
  const nav = document.querySelector<HTMLElement>('[data-toc]');
  if (!nav) return;
  const links = new Map<string, HTMLAnchorElement>();
  nav
    .querySelectorAll<HTMLAnchorElement>('[data-toc-link]')
    .forEach((a) => links.set(a.dataset.tocLink!, a));
  const headings = [...links.keys()]
    .map((id) => document.getElementById(id))
    .filter((el): el is HTMLElement => Boolean(el));
  if (!headings.length) return;

  const mark = (id: string | null) => {
    const active = links.get(id ?? '');
    const section = active?.dataset.tocDepth === '3' ? active.dataset.tocParent : (id ?? '');
    links.forEach((a, key) => {
      if (key === id) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
      if (a.dataset.tocDepth === '3') {
        const li = a.parentElement;
        if (li) li.hidden = a.dataset.tocParent !== section;
      }
    });
  };

  // Which heading is "current" is the last one to have crossed the top of the
  // viewport, not whatever happens to be intersecting — several are on screen
  // at once, and the topmost visible one is the section being read.
  const sync = () => {
    const line = 120;
    let current = headings[0]!.id;
    for (const h of headings) {
      if (h.getBoundingClientRect().top <= line) current = h.id;
      else break;
    }
    // At the very bottom the last section may never reach the line.
    if (window.innerHeight + window.scrollY >= document.body.scrollHeight - 4) {
      current = headings[headings.length - 1]!.id;
    }
    mark(current);
  };

  sync();
  on(window, 'scroll', sync, { passive: true } as AddEventListenerOptions);
  on(window, 'resize', sync);
}

/* ------------------------------------------------------------- carousel -- */
/* A native scroll-snap track keeps touch and keyboard scrolling intact; the
   dots below mirror the snapped card and advance the track on their own. */
function initCarousels() {
  const slow = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  document.querySelectorAll<HTMLElement>('[data-carousel]').forEach((root) => {
    const track = root.querySelector<HTMLElement>('[data-carousel-track]');
    const dots = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-carousel-dot]'));
    const slides = track ? (Array.from(track.children) as HTMLElement[]) : [];
    if (!track || dots.length < 2 || slides.length !== dots.length) return;

    let current = 0;
    let queued = false;

    const sync = () => {
      queued = false;
      collapse();
      current = nearest();
      while (current < dots.length - 1 && dots[current]!.hidden) current += 1;
      dots.forEach((d, i) => {
        d.setAttribute('aria-selected', String(i === current));
        d.tabIndex = i === current ? 0 : -1;
      });
    };

    /* Where the track ends up when slide i is asked for — clamped, because
       the last screenful of cards all share the same end position. */
    const target = (i: number) => {
      const pad = parseFloat(getComputedStyle(track).paddingLeft) || 0;
      const left = track.getBoundingClientRect().left;
      const delta = slides[i]!.getBoundingClientRect().left - left - pad;
      const max = Math.max(track.scrollWidth - track.clientWidth, 0);
      return Math.min(Math.max(track.scrollLeft + delta, 0), max);
    };

    const go = (i: number) => {
      track.scrollTo({ left: target(i), behavior: slow ? 'auto' : 'smooth' });
    };

    /* Matched against the same stops `go` scrolls to, not against the middle
       of the track: a card is "current" when it sits where the dot would put
       it. Ties go to the later card, so the end of the track belongs to the
       last award rather than the first one that happens to reach it. */
    const nearest = () => {
      const at = track.scrollLeft;
      let best = 0;
      let bestGap = Infinity;
      slides.forEach((_, i) => {
        const gap = Math.abs(target(i) - at);
        if (gap <= bestGap) {
          bestGap = gap;
          best = i;
        }
      });
      return best;
    };

    /* A dot that scrolls to the same place as the one after it is a dot that
       does nothing, which is what the trailing cards become once several fit
       on screen at once. Hide those and leave the end of the track to the
       last dot. */
    const collapse = () => {
      const stops = slides.map((_, i) => Math.round(target(i)));
      dots.forEach((d, i) => {
        d.hidden = i < dots.length - 1 && stops[i] === stops[i + 1];
      });
    };

    on(track, 'scroll', () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(sync);
    });
    on(window, 'resize', sync);

    dots.forEach((dot, i) => {
      on(dot, 'click', () => go(i));
      on(dot, 'keydown', (e) => {
        const key = (e as KeyboardEvent).key;
        if (key !== 'ArrowRight' && key !== 'ArrowLeft') return;
        const step = key === 'ArrowRight' ? 1 : -1;
        e.preventDefault();
        const next = (i + step + dots.length) % dots.length;
        go(next);
        dots[next].focus();
      });
    });

    sync();

    /* Auto-advance, paused while the reader is on it or the tab is hidden,
       and stopped outright by the toggle beside the dots. */
    const toggle = root.querySelector<HTMLButtonElement>('[data-carousel-toggle]');
    if (slow) {
      toggle?.remove();
      return;
    }
    let held = false;
    let stopped = false;
    const tick = () => {
      if (stopped || held || document.hidden || root.contains(document.activeElement)) return;
      let next = (current + 1) % slides.length;
      while (dots[next]!.hidden && next !== current) next = (next + 1) % slides.length;
      go(next);
    };
    const timer = window.setInterval(tick, 5200);
    cleanups.push(() => window.clearInterval(timer));
    on(root, 'pointerenter', () => {
      held = true;
    });
    on(root, 'pointerleave', () => {
      held = false;
    });

    if (toggle) {
      const pauseIcon = toggle.querySelector<HTMLElement>('[data-carousel-icon-pause]');
      const playIcon = toggle.querySelector<HTMLElement>('[data-carousel-icon-play]');
      on(toggle, 'click', () => {
        stopped = !stopped;
        toggle.setAttribute('aria-pressed', String(stopped));
        const label = stopped ? 'Play the awards carousel' : 'Pause the awards carousel';
        toggle.setAttribute('aria-label', label);
        toggle.dataset.tip = stopped ? 'Play the carousel' : 'Pause the carousel';
        if (pauseIcon) pauseIcon.hidden = stopped;
        if (playIcon) playIcon.hidden = !stopped;
      });
    }
  });
}

/* ----------------------------------------------------------- copy bibtex -- */
function initCopy() {
  document.querySelectorAll<HTMLButtonElement>('[data-copy]').forEach((btn) => {
    on(btn, 'click', async () => {
      const value = btn.dataset.copy ?? '';
      try {
        await navigator.clipboard.writeText(value);
        const label = btn.querySelector('[data-copy-label]');
        if (label) {
          const prev = label.textContent;
          label.textContent = 'Copied';
          window.setTimeout(() => (label.textContent = prev), 1600);
        }
      } catch {
        /* clipboard blocked — the visible value is still selectable */
      }
    });
  });
}

/* ---------------------------------------------------------- contact form -- */
function initContactForm() {
  const form = document.querySelector<HTMLFormElement>('[data-contact-form]');
  if (!form) return;
  const status = form.querySelector<HTMLElement>('[data-form-status]');
  const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]');
  const started = form.querySelector<HTMLInputElement>('input[name="nw-form-started"]');
  if (started) started.value = String(Date.now());

  const say = (msg: string, ok: boolean) => {
    if (!status) return;
    status.hidden = false;
    status.textContent = msg;
    status.dataset.state = ok ? 'ok' : 'error';
  };

  on(form, 'submit', async (ev) => {
    ev.preventDefault();
    if (started && Date.now() - Number(started.value) < 1500) {
      say('That was quick. Give it a moment and try again.', false);
      return;
    }
    submit?.setAttribute('disabled', '');
    form.dataset.sending = 'true';
    try {
      const res = await fetch(form.action, {
        method: 'POST',
        body: new FormData(form),
        headers: { Accept: 'application/json' },
      });
      if (res.ok) {
        form.reset();
        if (started) started.value = String(Date.now());
        say('Thanks — your message is on its way. I reply within 24 hours.', true);
      } else {
        say('That did not send. Email noah@noahweidig.com directly and it will reach me.', false);
      }
    } catch {
      say('Network trouble. Email noah@noahweidig.com directly and it will reach me.', false);
    } finally {
      submit?.removeAttribute('disabled');
      delete form.dataset.sending;
    }
  });
}

/* ------------------------------------------------------------------ boot -- */
function boot() {
  cleanups.forEach((fn) => fn());
  cleanups = [];
  initTheme();
  initHeader();
  initReveal();
  initGlow();
  initMarquees();
  initFilters();
  initTabs();
  initSearch();
  initTypewriter();
  initCopy();
  initCarousels();
  initCodeCopy();
  initHeadingAnchors();
  initReadingMode();
  initLightbox();
  initTooltips();
  initToc();
  initContactForm();
  initBackToTop();
}

boot();
document.addEventListener('astro:page-load', boot);
