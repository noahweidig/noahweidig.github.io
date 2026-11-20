/* ---------------------------------------------------------------- theme -- */
import { on } from './dom';

type ThemePref = 'light' | 'dark';

const other = (pref: ThemePref): ThemePref => (pref === 'dark' ? 'light' : 'dark');
const currentPref = (): ThemePref =>
  document.documentElement.dataset.themePref === 'light' ? 'light' : 'dark';

function updateToggleLabels(pref: ThemePref) {
  document.querySelectorAll<HTMLButtonElement>('[data-theme-toggle]').forEach((b) => {
    b.setAttribute('aria-label', `Color theme: ${pref}. Switch to ${other(pref)}`);
  });
}

function applyTheme(pref: ThemePref) {
  document.documentElement.dataset.theme = pref;
  document.documentElement.dataset.themePref = pref;
  try {
    localStorage.setItem('nw-theme', pref);
  } catch {
    /* private mode — the in-page toggle still works for this session */
  }
  updateToggleLabels(pref);
}

function switchTheme(btn: HTMLElement) {
  const next = other(currentPref());
  const root = document.documentElement;
  if (!document.startViewTransition || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    applyTheme(next);
    return;
  }
  const r = btn.getBoundingClientRect();
  const x = r.left + r.width / 2;
  const y = r.top + r.height / 2;
  const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  root.classList.add('theme-vt');
  const t = document.startViewTransition(() => applyTheme(next));
  t.ready
    .then(() =>
      root.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
        {
          duration: 650,
          easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
          pseudoElement: '::view-transition-new(root)',
        },
      ),
    )
    .catch(() => {});
  t.finished.finally(() => root.classList.remove('theme-vt'));
}

export function initTheme() {
  updateToggleLabels(currentPref());
  document.querySelectorAll<HTMLButtonElement>('[data-theme-toggle]').forEach((btn) => {
    on(btn, 'click', () => switchTheme(btn));
  });
}
