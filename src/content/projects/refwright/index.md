---
title: RefWright
date: '2026-11-17'
description: Find PDFs, Check Retractions and Citations, Tag, and File Papers in Zotero
categories:
  - Zotero
  - Research Tools
featured: false
links:
  - label: 'View Project'
    href: 'https://noahweidig.com/refwright/'
    variant: primary
    external: true
  - label: 'GitHub'
    href: 'https://github.com/noahweidig/refwright'
    external: true
image-alt: 'The RefWright project site'
---

RefWright is a Zotero plugin that finds PDFs, checks retractions and citations, tags papers, and files them into collections, all inside Zotero.

It needs no account, sends no analytics, and runs no server. AI features are optional. It requires Zotero 8 or later and is free and open source under AGPL-3.0-or-later.

PDF finding is open-access only. RefWright tries 13 source stages in order and stops at the first valid PDF: Unpaywall, PubMed Central, Europe PMC, Semantic Scholar, Crossref, CORE, OpenAIRE, preprint servers (arXiv, bioRxiv, medRxiv, Zenodo and others), HAL, DOAJ, OSTI, OpenAlex, an Internet Archive retry for dead links, and free-to-read publisher pages. A file must start with `%PDF-` and be 10 KB to 100 MB. If its embedded DOI doesn't match the item's, it isn't attached and the item is tagged `fulltext:check-needed`. Items with no open copy can be exported to CSV for interlibrary loan.

The retraction check queries PubMed first, then Crossref, which includes Retraction Watch data. The citation check compares title, year, journal, volume, issue, pages and first author against Crossref and tags mismatches without changing any field. Full Check runs PDF, retraction and citation checks together.

Tag and collection suggestions can use any of 8 AI providers: OpenAI, Anthropic, Google Gemini, DeepSeek, OpenRouter, Cohere, any OpenAI-compatible endpoint, or a local Ollama model. Keys stay in Zotero preferences and go only to the provider you pick.

Install the `.xpi` from the [latest release](https://github.com/noahweidig/refwright/releases/latest) through Zotero's Tools > Plugins > Install Plugin From File, then add a contact email in Settings > RefWright.
