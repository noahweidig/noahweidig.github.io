---
title: FPA-FOD Wildfire Ignitions
date: '2026-10-16'
description: Interactive map of 33 years of U.S. wildfire ignition points
categories:
  - Fire
  - Data Science
featured: false
links:
  - label: 'Visit Site'
    href: 'https://noahweidig.com/fpa-fod/'
    variant: primary
    external: true
  - label: 'GitHub'
    href: 'https://github.com/noahweidig/fpa-fod'
    variant: ghost
    external: true
image-alt: 'The FPA-FOD wildfire ignitions map'
---

An interactive map of U.S. wildfire ignition points from the Forest Service's Fire Program Analysis Fire-Occurrence Database (FPA-FOD), 1992 to 2024. You can color, filter, and chart fires by cause, year, size, owner, agency, and place.

It runs in the browser with MapLibre GL JS and a PMTiles file, with no backend. Views live in the URL so they can be shared, and DuckDB-WASM powers exact counts, charts, and CSV, GeoJSON, and Parquet exports that carry the dataset citation.
