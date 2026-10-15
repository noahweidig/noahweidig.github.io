---
title: iconifyr
date: '2026-10-15'
description: An R Client for the Iconify Icon API
categories:
  - R
  - Data Science
featured: false
links:
  - label: 'View Package'
    href: 'https://noahweidig.com/iconifyr/'
    variant: primary
    external: true
  - label: 'GitHub'
    href: 'https://github.com/noahweidig/iconifyr'
    variant: ghost
    external: true
image-alt: 'The iconifyr package documentation site'
---

iconifyr is an R client for the Iconify API, which serves 400,000+ open-source icons from 240+ sets. You ask for an icon by its `prefix:name` id and get it back as SVG, inline HTML, or PNG, with color and size set in the call.

It also searches across sets, caches responses on disk, retries on 429 and 5xx errors, and works with self-hosted Iconify APIs. `iconify_license()` checks a set's license and warns when it requires attribution, so you find out before you ship the icon, not after.
