/* -------------------------------------------------------------- filters -- */
import { on } from './dom';

export function initFilters() {
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
