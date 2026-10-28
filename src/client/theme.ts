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

export function initTheme() {
  updateToggleLabels(currentPref());
  document.querySelectorAll<HTMLButtonElement>('[data-theme-toggle]').forEach((btn) => {
    on(btn, 'click', () => {
      applyTheme(other(currentPref()));
      btn.classList.remove('is-spinning');
      btn.getBoundingClientRect();
      btn.classList.add('is-spinning');
    });
    on(btn, 'animationend', () => btn.classList.remove('is-spinning'));
  });
}
