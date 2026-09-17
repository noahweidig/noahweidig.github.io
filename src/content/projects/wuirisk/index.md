---
title: WUI Wildfire Explorer
date: '2026-03-22'
description: A GEE App for Visualizing Risk
categories:
  - Fire
  - Geospatial
featured: false
links:
  - label: 'Launch Tool'
    href: 'https://ee-weidignc.projects.earthengine.app/view/wui-wildfire'
    variant: primary
    external: true
  - label: 'Read the Paper'
    href: 'https://doi.org/10.1071/WF24110'
    variant: ghost
    external: true
---

<img src="../../media/albums/projects/wuirisk.webp" alt="The WUI Wildfire Explorer mapping large fires across the United States" width="1600" height="1000" loading="lazy" decoding="async">

The WUI Wildfire Explorer is a Google Earth Engine app built from the analysis behind my master's thesis: 35 years of large wildfires (>200 ha) across the eastern United States, 1986–2021, joined to the USFS wildland-urban interface (WUI) layer and modeled against weather, fuel, ignition, and suppression variables. The published result, in the _International Journal of Wildland Fire_ ([Weidig et al. 2024](https://doi.org/10.1071/WF24110)): WUI fires made up 45% of large wildfires and 55% of the area burned, ran 46% larger on average than fires outside the WUI, and were becoming more frequent in spring — even as most of the recent growth in fire activity was happening outside the WUI, not inside it.

This app is that dataset made explorable. Step through years from 1986 to 2021 and watch fire perimeters appear, colored by burn severity, against the WUI classification underneath — interface versus intermix, and how much housing sits in vegetated land. Click a perimeter for its year, size, and WUI status. The point is to make an abstract statistic concrete: you can watch development push into fire-prone country in real time and see exactly where the two meet.

Same source data — MTBS perimeters and the USFS WUI layer — that [fireR](/projects/firer/) packages for reuse in R.
