/* ---------------------------------------------------------------- theme -- */
import { on } from './dom';

type ThemePref = 'light' | 'dark' | 'system';
const THEME_ORDER: ThemePref[] = ['light', 'dark', 'system'];

function resolveTheme(pref: ThemePref): 'light' | 'dark' {
  if (pref === 'system') {
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  return pref;
}

function applyThemeImages(theme: 'light' | 'dark') {
  document.querySelectorAll<HTMLImageElement>('img[data-theme-src-dark]').forEach((img) => {
    const src = theme === 'dark' ? img.dataset.themeSrcDark : img.dataset.themeSrcLight;
    const srcset = theme === 'dark' ? img.dataset.themeSrcsetDark : img.dataset.themeSrcsetLight;
    if (src) img.src = src;
    if (srcset) img.srcset = srcset;
  });
}

function updateToggleLabels(pref: ThemePref) {
  const next = THEME_ORDER[(THEME_ORDER.indexOf(pref) + 1) % THEME_ORDER.length];
  document.querySelectorAll<HTMLButtonElement>('[data-theme-toggle]').forEach((b) => {
    b.setAttribute('aria-label', `Color theme: ${pref}. Switch to ${next}`);
  });
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
    ?.setAttribute('content', theme === 'light' ? '#ffffff' : '#000000');
  applyThemeImages(theme);
  updateToggleLabels(pref);
}

export function initTheme() {
  updateToggleLabels((document.documentElement.dataset.themePref as ThemePref) ?? 'system');
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
