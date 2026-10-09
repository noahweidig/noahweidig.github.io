/* --------------------------------------------------------------- tooltip -- */
import { cleanups, on } from './dom';

/* One floating element for the whole page: an ancestor with overflow hidden
   would clip a tooltip rendered inside the trigger. */
const TIP_ID = 'nw-tip';
let tipEl: HTMLElement | null = null;
let tipTimer: number | undefined;
let tipTarget: HTMLElement | null = null;

const tipRoot = () => {
  if (!tipEl?.isConnected) {
    tipEl = document.createElement('div');
    tipEl.id = TIP_ID;
    tipEl.className = 'nw-tip';
    tipEl.setAttribute('role', 'tooltip');
    document.body.appendChild(tipEl);
  }
  return tipEl;
};

export function showTip(target: HTMLElement) {
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

  tipTarget = target;
  target.setAttribute('aria-describedby', TIP_ID);
}

export function hideTip() {
  window.clearTimeout(tipTimer);
  if (tipEl) delete tipEl.dataset.show;
  if (tipTarget) {
    tipTarget.removeAttribute('aria-describedby');
    tipTarget = null;
  }
}

export function initTooltips() {
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

const escapeHtml = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
