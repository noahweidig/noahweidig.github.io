/* TEMPORARY: on-screen viewport readout for diagnosing the iOS nav bar bug.
   Enable with ?navdebug=1 (sticks for the tab); ?navdebug=0 turns it off. */
const KEY = 'navdebug';

export function initNavDebug() {
  try {
    const q = new URLSearchParams(location.search).get(KEY);
    if (q === '1') sessionStorage.setItem(KEY, '1');
    if (q === '0') sessionStorage.removeItem(KEY);
    if (sessionStorage.getItem(KEY) !== '1') return;
  } catch {
    return;
  }
  let el = document.getElementById('navdebug');
  if (!el) {
    el = document.createElement('pre');
    el.id = 'navdebug';
    el.style.cssText =
      'position:fixed;left:0;right:0;bottom:0;z-index:2147483647;margin:0;padding:4px 6px;' +
      'font:10px/1.3 ui-monospace,monospace;color:#0f0;background:rgb(0 0 0/.85);pointer-events:none;';
    document.documentElement.append(el);
  }
  const out = el;
  const draw = () => {
    const v = window.visualViewport;
    const h = document.getElementById('site-header')?.getBoundingClientRect();
    const d = document.documentElement;
    out.textContent = [
      `scrollY ${Math.round(scrollY)}  inner ${innerWidth}x${innerHeight}  client ${d.clientWidth}x${d.clientHeight}`,
      `vv off ${v?.offsetLeft.toFixed(1)},${v?.offsetTop.toFixed(1)} page ${v?.pageLeft.toFixed(1)},${v?.pageTop.toFixed(1)} size ${v?.width.toFixed(1)}x${v?.height.toFixed(1)} scale ${v?.scale}`,
      `header top ${h ? Math.round(h.top) : '-'} h ${h ? Math.round(h.height) : '-'}  body ${getComputedStyle(document.body).position}`,
      `html: ${
        [...d.attributes]
          .map((a) => a.name)
          .filter((n) => /search|menu|scrolled/.test(n))
          .join(' ') || '-'
      }`,
    ].join('\n');
  };
  draw();
  for (const t of ['scroll', 'resize']) addEventListener(t, draw, { passive: true });
  window.visualViewport?.addEventListener('scroll', draw);
  window.visualViewport?.addEventListener('resize', draw);
}
