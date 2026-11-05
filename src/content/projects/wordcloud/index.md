---
title: WordCloud Studio
date: '2025-01-05'
description: Word Cloud Generator
categories:
  - Data Science
featured: false
links:
  - label: 'Launch Tool'
    href: 'https://noahweidig.com/wordcloud/'
    variant: primary
    external: true
  - label: 'GitHub'
    href: 'https://github.com/noahweidig/wordcloud'
    variant: ghost
    external: true
image-alt: 'WordCloud Studio generating a word cloud'
---

WordCloud Studio turns a block of text into a word cloud. Paste something in or upload a file, and it sizes each word by how often it shows up, with colors, fonts, and shapes you can adjust until it looks the way you want.

It's free and needs no account. I built it mostly because the existing generators buried a ten-second task under ads and sign-up walls.

You can paste text or upload a `.txt` file, drop common English words with the built-in stopword list (or add your own), and set a minimum frequency and a maximum word count. Word size scales linearly, by square root, or by log, so one dominant word doesn't swamp the rest. Rotation, fonts, spiral type, padding, canvas size, and background are adjustable, and colors can be a single color, a cycling palette, or a gradient by frequency. Shape masks include a circle, heart, star, speech bubble, and cloud, or you can upload your own PNG. Export is PNG (transparent or solid background) or copy to clipboard.

It's built with React, TypeScript, Vite, and d3-cloud, and runs fully in the browser.
