## 2024-05-21 - CTA Button Accessibility
**Learning:** Hugo Blox CTA buttons use FontAwesome icons that are decorative but lack `aria-hidden="true"`, causing potential screen reader noise. Additionally, `target="_blank"` links lack screen reader warning about context change.
**Action:** In all future button implementations, ensure decorative icons are hidden from AT and external links include `.sr-only` warning text.
