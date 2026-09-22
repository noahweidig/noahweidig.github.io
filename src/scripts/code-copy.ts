/* ---------------------------------------------------------- code blocks -- */
import { on } from './dom';
import { hideTip, showTip } from './tooltips';

const COPY_ICON =
  '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>';
const CHECK_ICON =
  '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';

export function initCodeCopy() {
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
