/* ----------------------------------------------------------------- tabs -- */
import { on } from './dom';

export function initTabs() {
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
