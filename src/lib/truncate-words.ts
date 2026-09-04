/* Single-line truncation that cuts on word boundaries: CSS ellipsis alone
   would slice mid-word. Elements opt in with `data-truncate-words` and must
   already be styled to clip (`truncate`), which stays as the fallback when a
   single word is still too wide. */
function fit(el: HTMLElement) {
  const full = el.dataset.fullText ?? (el.dataset.fullText = (el.textContent ?? '').trim());
  el.textContent = full;
  if (el.scrollWidth <= el.clientWidth) return;

  const words = full.split(/\s+/);
  while (words.length > 1) {
    words.pop();
    el.textContent = `${words.join(' ')}…`;
    if (el.scrollWidth <= el.clientWidth) return;
  }
}

function fitAll() {
  document.querySelectorAll<HTMLElement>('[data-truncate-words]').forEach(fit);
}

let started = false;

export function initTruncateWords() {
  fitAll();
  if (started) return;
  started = true;
  window.addEventListener('resize', fitAll);
  document.fonts?.ready.then(fitAll);
}
