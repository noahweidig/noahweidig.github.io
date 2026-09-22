/* ------------------------------------------------------------ typewriter -- */
import { cleanups } from './dom';

export function initTypewriter() {
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
