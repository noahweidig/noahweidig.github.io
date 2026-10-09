/* TEMPORARY: on-screen viewport readout for diagnosing the iOS nav bar bug.
   Enable with ?navdebug=1 (sticks for the tab); ?navdebug=0 turns it off. The
   event log survives navigations (sessionStorage) so a zoom or offset change can
   be traced to the step that caused it. */
const KEY = 'navdebug';
const LOG = 'navdebug-log';

let bound = false;

const snap = () => {
  const v = window.visualViewport;
  return `s${v?.scale.toFixed(2)} in${innerWidth}x${innerHeight} off${v?.offsetTop.toFixed(0)}`;
};

const note = (label: string) => {
  try {
    const log: string[] = JSON.parse(sessionStorage.getItem(LOG) ?? '[]');
    log.push(`${(performance.now() / 1000).toFixed(1)}s ${label} ${snap()}`);
    sessionStorage.setItem(LOG, JSON.stringify(log.slice(-14)));
  } catch {
    /* storage unavailable */
  }
};

export function initNavDebug() {
  try {
    const q = new URLSearchParams(location.search).get(KEY);
    if (q === '1') sessionStorage.setItem(KEY, '1');
    const sx = new URLSearchParams(location.search).get('sx');
    if (sx !== null) {
      const flag = ['nolock', 'nofocus', 'nomodal'].find((f) => f === sx) ?? '';
      sessionStorage.setItem('sx', flag);
    }
    if (q === '0') {
      sessionStorage.removeItem(KEY);
      sessionStorage.removeItem(LOG);
    }
    if (sessionStorage.getItem(KEY) !== '1') return;
  } catch {
    return;
  }
  note(`load ${location.pathname} sx=${sessionStorage.getItem('sx') ?? ''}`);
  let el = document.getElementById('navdebug');
  if (!el) {
    el = document.createElement('pre');
    el.id = 'navdebug';
    el.style.cssText =
      'position:fixed;left:0;right:0;bottom:0;z-index:2147483647;margin:0;padding:4px 6px;' +
      'box-sizing:border-box;max-width:100vw;white-space:pre-wrap;word-break:break-all;' +
      'font:9px/1.25 ui-monospace,monospace;color:#0f0;background:rgb(0 0 0/.85);pointer-events:none;';
    document.documentElement.append(el);
  }
  const out = el;
  const draw = () => {
    const v = window.visualViewport;
    const h = document.getElementById('site-header')?.getBoundingClientRect();
    const d = document.documentElement;
    let log = '';
    try {
      log = (JSON.parse(sessionStorage.getItem(LOG) ?? '[]') as string[]).join('\n');
    } catch {
      /* storage unavailable */
    }
    out.textContent = [
      `NOW scrollY ${Math.round(scrollY)} ${snap()} client ${d.clientWidth}x${d.clientHeight}`,
      `vv page ${v?.pageLeft.toFixed(0)},${v?.pageTop.toFixed(0)} size ${v?.width.toFixed(0)}x${v?.height.toFixed(0)} hdr ${h ? Math.round(h.top) : '-'} body ${getComputedStyle(document.body).position}`,
      log,
    ].join('\n');
  };
  draw();
  if (bound) return;
  bound = true;
  let last = snap().split(' off')[0];
  window.visualViewport?.addEventListener('resize', () => {
    const now = snap().split(' off')[0];
    if (now !== last) {
      last = now;
      note('vv-resize');
    }
    draw();
  });
  for (const t of ['scroll', 'resize']) addEventListener(t, draw, { passive: true });
  window.visualViewport?.addEventListener('scroll', draw);
  const id = (e: Event) => (e.target as HTMLElement | null)?.id || (e.target as Element)?.tagName;
  for (const t of ['focusin', 'focusout'])
    document.addEventListener(t, (e) => (note(`${t} ${id(e)}`), draw()), true);
  for (const t of ['close', 'cancel'])
    document.addEventListener(t, (e) => (note(`${t} ${id(e)}`), draw()), true);
  document.addEventListener('click', (e) => (note(`click ${id(e)}`), draw()), true);
  addEventListener('pagehide', () => note('pagehide'));
}
