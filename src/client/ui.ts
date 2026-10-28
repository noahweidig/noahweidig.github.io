/**
 * Site behaviour: theme toggle, sticky header, mobile menu, scroll reveal,
 * pointer-tracked card glow, filter bars, tabs and the
 * Pagefind search dialog. Runs once per page load.
 *
 * Each feature lives in its own `init*()` module under `src/client/`; this
 * file just wires them together in the order `boot()` always ran them in.
 */

import { resetCleanups } from './dom';
import { initTheme } from './theme';
import { initHeader } from './header';
import { initReveal } from './reveal';
import { initGlow } from './glow';
import { initFilters } from './filters';
import { initTabs } from './tabs';
import { initSearch } from './search';
import { initHeadingAnchors } from './heading-anchors';
import { initTooltips } from './tooltips';
import { initLightbox } from './lightbox';
import { initBackToTop } from './back-to-top';
import { initToc } from './toc';
import { initCarousels } from './carousels';
import { initFaqAccordion } from './faq-accordion';
import { initCopy } from './copy';
import { initShareRow } from './share-row';
import { initPopups } from './popup';
import { initContactForm } from './contact-form';

/* ------------------------------------------------------------------ boot -- */
function boot() {
  resetCleanups();
  initTheme();
  initHeader();
  initReveal();
  initGlow();
  initFilters();
  initTabs();
  initSearch();
  initCopy();
  initCarousels();
  initHeadingAnchors();
  initLightbox();
  initTooltips();
  initToc();
  initShareRow();
  initPopups();
  initFaqAccordion();
  initContactForm();
  initBackToTop();
}

boot();
