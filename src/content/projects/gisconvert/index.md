---
title: GIS Convert
date: '2026-03-25'
description: Browser-Based GIS File Conversion With No Upload
categories:
  - Geospatial
featured: true
links:
  - label: 'Launch Tool'
    href: 'https://gisconvert.spatialitix.com/'
    variant: primary
    external: true
---

<img src="../../media/albums/projects/gisconvert.webp" alt="GIS Convert's browser-based GIS file conversion interface" width="1200" height="630" loading="lazy" decoding="async">

GIS Convert converts spatial data between formats entirely in the browser: Shapefile, GeoJSON, TopoJSON, KML/KMZ, GPX, GML, CSV, and WKT, with reprojection across 180+ coordinate systems. Nothing is uploaded — files are parsed and converted client-side, then downloaded back out.

It also validates geometry and previews the result on a map before you export, so you can catch a bad file before it breaks a downstream pipeline.

I built it for the same reason as MapLab: people kept handing me spatial files in the wrong format and I was tired of doing the conversion by hand.
