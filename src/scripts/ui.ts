/**
 * Site behaviour: theme toggle, sticky header, mobile menu, scroll reveal,
 * pointer-tracked card glow, filter bars, tabs, marquee cloning and the
 * Pagefind search dialog. Everything re-binds on `astro:page-load` so it
 * survives client-side navigations.
 *
 * Each feature lives in its own `init*()` module under `src/scripts/`; this
 * file just wires them together in the order `boot()` always ran them in.
 */

import { resetCleanups } from './dom';
import { initTheme } from './theme';
import { initHeader } from './header';
import { initReveal } from './reveal';
import { initGlow } from './glow';
import { initMarquees } from './marquees';
import { initGlobe } from './globe';
import { initFilters } from './filters';
import { initTabs } from './tabs';
import { initSearch } from './search';
import { initTypewriter } from './typewriter';
import { initCodeCopy } from './code-copy';
import { initHeadingAnchors } from './heading-anchors';
import { initReadingMode } from './reading-mode';
import { initTooltips } from './tooltips';
import { initLightbox } from './lightbox';
import { initBackToTop } from './back-to-top';
import { initToc } from './toc';
import { initCarousels } from './carousels';
import { initFaqAccordion } from './faq-accordion';
import { initCopy } from './copy';
import { initShareRow } from './share-row';
import { initContactForm } from './contact-form';

/* ------------------------------------------------------------------ boot -- */
function boot() {
  resetCleanups();
  initTheme();
  initHeader();
  initReveal();
  initGlow();
  initMarquees();
  initGlobe();
  initFilters();
  initTabs();
  initSearch();
  initTypewriter();
  initCopy();
  initCarousels();
  initCodeCopy();
  initHeadingAnchors();
  initReadingMode();
  initLightbox();
  initTooltips();
  initToc();
  initShareRow();
  initFaqAccordion();
  initContactForm();
  initBackToTop();
}

boot();
document.addEventListener('astro:page-load', boot);
