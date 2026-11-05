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

The main functions are `iconify_get()` for SVG, `iconify_png()` for PNG, `iconify_html()` for inlining in R Markdown, Quarto, or Shiny, `iconify_download()` to save files, `iconify_search()` to find icons across sets, and `iconify_license()` to check a set's license. Responses are cached on disk by default, and the API URL is configurable for self-hosted servers. The package is on GitHub and has a pkgdown site with a getting-started vignette and an icon gallery.
