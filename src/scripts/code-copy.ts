/* ---------------------------------------------------------- code blocks -- */
import { on } from './dom';
import { hideTip, showTip } from './tooltips';
import { iconSvg } from './icon';

const COPY_ICON = iconSvg('copy', 15);
const CHECK_ICON = iconSvg('check', 15);

export function initCodeCopy() {
  const blocks = document.querySelectorAll<HTMLPreElement>('.prose-nw pre');
  blocks.forEach((pre) => {
    // boot() runs again on astro:page-load and tears down every `on()` binding
    // first, so a block wrapped on an earlier pass keeps its button and only
    // needs the click handler re-bound.
    const wrapped = pre.parentElement?.dataset.codeBlock === 'true';
    let btn = wrapped ? pre.parentElement!.querySelector<HTMLButtonElement>('.code-copy') : null;

    if (!btn) {
      // Wrapped rather than positioned on the <pre> itself: the <pre> scrolls
      // horizontally, and a button inside it would scroll away with the code.
      const wrap = document.createElement('div');
      wrap.dataset.codeBlock = 'true';
      wrap.className = 'relative';
      pre.replaceWith(wrap);
      wrap.appendChild(pre);

      // Icon only — the word "Copy" sat over the first line of code. The label
      // it replaces comes back as a tooltip on hover.
      btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'code-copy';
      btn.innerHTML = COPY_ICON;
      btn.dataset.tip = 'Copy';
      btn.setAttribute('aria-label', 'Copy code to clipboard');
      wrap.appendChild(btn);
    }
    const copyBtn = btn;

    on(copyBtn, 'click', async () => {
      let tip = 'Copied';
      try {
        await navigator.clipboard.writeText(pre.innerText.replace(/\n$/, ''));
        copyBtn.innerHTML = CHECK_ICON;
        copyBtn.dataset.state = 'copied';
      } catch {
        // Clipboard blocked (insecure context, or a permissions policy): the
        // code is still selectable, so say what happened rather than lie.
        tip = 'Select it and copy';
      }
      copyBtn.dataset.tip = tip;
      showTip(copyBtn);
      window.setTimeout(() => {
        copyBtn.innerHTML = COPY_ICON;
        delete copyBtn.dataset.state;
        copyBtn.dataset.tip = 'Copy';
        hideTip();
      }, 1600);
    });
  });
}
