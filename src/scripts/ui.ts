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
  document.querySelectorAll<HTMLElement>('[data-marquee]').forEach((track) => {
    if (track.dataset.cloned === 'true') return;
    track.append(...Array.from(track.children).map((c) => c.cloneNode(true)));
    track.dataset.cloned = 'true';
  });
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
type PagefindResult = {
  data: () => Promise<{
    url: string;
    meta: Record<string, string>;
    excerpt: string;
  }>;
};
type Pagefind = { search: (q: string) => Promise<{ results: PagefindResult[] }> };
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

function initSearch() {
  const dialog = document.getElementById('site-search') as HTMLDialogElement | null;
  if (!dialog) return;
  const input = dialog.querySelector<HTMLInputElement>('#search-input');
  const out = dialog.querySelector<HTMLElement>('#search-results');
  if (!input || !out) return;

  const open = () => {
    if (!dialog.open) dialog.showModal();
    input.focus();
    input.select();
    void loadPagefind();
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

  let token = 0;
  const render = (html: string) => {
    out.innerHTML = html;
  };

  const run = async () => {
    const q = input.value.trim();
    const mine = ++token;
    if (!q) {
      render('<p class="px-3 py-6 text-center text-sm text-faint">Type to search the site.</p>');
      return;
    }
    const pf = await loadPagefind();
    if (mine !== token) return;
    if (!pf) {
      render(
        '<p class="px-3 py-6 text-center text-sm text-faint">Search index is only available in a production build.</p>',
      );
      return;
    }
    const { results } = await pf.search(q);
    if (mine !== token) return;
    if (!results.length) {
      render(
        `<p class="px-3 py-6 text-center text-sm text-faint">No matches for “${escapeHtml(q)}”.</p>`,
      );
      return;
    }
    const data = await Promise.all(results.slice(0, 8).map((r) => r.data()));
    if (mine !== token) return;
    render(
      data
        .map(
          (d) => `
        <a href="${basePath()}${d.url}" class="block rounded-md px-3 py-3 transition-colors hover:bg-raised">
          <span class="block text-[0.95rem] font-medium text-ink">${escapeHtml(d.meta.title ?? d.url)}</span>
          <span class="mt-1 block text-[0.82rem] leading-relaxed text-dim">${d.excerpt}</span>
        </a>`,
        )
        .join(''),
    );
  };

  let timer: number | undefined;
  on(input, 'input', () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(run, 140);
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
