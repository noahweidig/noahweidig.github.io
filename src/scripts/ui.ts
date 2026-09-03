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
function applyTheme(theme: 'light' | 'dark') {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem('nw-theme', theme);
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
      applyTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light');
    });
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
      history.replaceState(null, '', url);
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
 * unconditionally produced /new-website/new-website/cv/. Prefix only when it
 * is missing, which keeps this right either way.
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

  const renderResults = (items: PagefindData[], q: string) => {
    if (!items.length) {
      out.innerHTML = `<p class="px-3 py-10 text-center text-sm text-faint">No matches${
        q ? ` for &ldquo;${escapeHtml(q)}&rdquo;` : ''
      }.</p>`;
      setActive(-1);
      return;
    }
    out.innerHTML = items
      .map((d, i) => {
        const section = d.meta.section
          ? `<span class="chip shrink-0">${escapeHtml(d.meta.section)}</span>`
          : '';
        return `<a id="search-opt-${i}" role="option" aria-selected="false" href="${resultHref(d.url)}"
          class="block rounded-md px-3 py-2.5 transition-colors hover:bg-raised">
          <span class="flex items-start justify-between gap-3">
            <span class="text-[0.95rem] font-medium text-ink">${escapeHtml(d.meta.title ?? d.url)}</span>
            ${section}
          </span>
          <span class="mt-1 block text-[0.82rem] leading-relaxed text-dim">${d.excerpt}</span>
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
    const pf = await loadPagefind();
    if (mine !== token) return;
    if (!pf) {
      out.innerHTML =
        '<p class="px-3 py-10 text-center text-sm text-faint">Search index is only available in a production build.</p>';
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
    if (mine !== token) return;
    renderResults(data, q);
    renderFilters(counts);
    syncBadge();
    if (status) {
      status.textContent = `${results.length} result${results.length === 1 ? '' : 's'}`;
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

/* ----------------------------------------------------------- print / cv -- */
function initPrint() {
  document.querySelectorAll('[data-print]').forEach((b) => on(b, 'click', () => window.print()));
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
  initPrint();
  initContactForm();
}

boot();
document.addEventListener('astro:page-load', boot);
