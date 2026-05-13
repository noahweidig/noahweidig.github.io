---
title: "Publications"
date: 2024-05-19
type: landing

design:
  spacing: "5rem"

sections:
  - block: markdown
    content:
      title: "Publications"
      subtitle: ""
      text: |
        A live feed of my research output, pulled automatically from
        [Zotero](https://www.zotero.org/noahweidig/publications). Updated every
        two weeks.

  - block: collection
    id: journal-articles
    content:
      title: Journal Articles
      filters:
        folders:
          - pubs/journal-articles
        featured_only: false
      count: 100
    design:
      view: article-grid
      fill_image: false
      columns: 2
      show_date: true
      show_read_time: false
      show_read_more: false

  - block: collection
    id: thesis
    content:
      title: Thesis
      filters:
        folders:
          - pubs/thesis
        featured_only: false
      count: 100
    design:
      view: article-grid
      fill_image: false
      columns: 2
      show_date: true
      show_read_time: false
      show_read_more: false

  - block: collection
    id: presentations
    content:
      title: Presentations
      filters:
        folders:
          - pubs/presentations
        featured_only: false
      count: 100
    design:
      view: article-grid
      fill_image: false
      columns: 2
      show_date: true
      show_read_time: false
      show_read_more: false

  - block: collection
    id: webinars
    content:
      title: Webinars
      filters:
        folders:
          - pubs/webinars
        featured_only: false
      count: 100
    design:
      view: article-grid
      fill_image: false
      columns: 2
      show_date: true
      show_read_time: false
      show_read_more: false

  - block: collection
    id: peer-reviews
    content:
      title: Peer Reviews
      filters:
        folders:
          - pubs/peer-reviews
        featured_only: false
      count: 100
    design:
      view: article-grid
      fill_image: false
      columns: 2
      show_date: true
      show_read_time: false
      show_read_more: false

  - block: collection
    id: media-coverage
    content:
      title: Media Coverage
      filters:
        folders:
          - pubs/media-coverage
        featured_only: false
      count: 100
    design:
      view: article-grid
      fill_image: false
      columns: 2
      show_date: true
      show_read_time: false
      show_read_more: false
---
