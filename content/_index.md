---
# Leave the homepage title empty to use the site title
title: ''
summary: ''
date: 2026-01-05
type: landing

design:
  # Default section spacing
  spacing: '0'

sections:
  # Developer Hero - Gradient background with name, role, social, and CTAs
  - block: dev-hero
    id: hero
    content:
      username: me
      greeting: "Hi, I'm"
      show_status: true
      show_scroll_indicator: true
      typewriter:
        enable: true
        prefix: "I build"
        strings:
          - "geospatial analyses"
          - "remote sensing workflows"
          - "data-driven insights"
          - "GIS applications"
        type_speed: 70
        delete_speed: 40
        pause_time: 2500
      cta_buttons:
        - text: View My Work
          url: "#projects"
          icon: arrow-down
        - text: Get In Touch
          url: "#contact"
          icon: envelope
    design:
      style: centered
      avatar_shape: circle
      animations: true
      background:
        color:
          light: "#fafafa"
          dark: "#0a0a0f"
      spacing:
        padding: ["6rem", "0", "4rem", "0"]
  
  # Filterable Portfolio - Alpine.js powered project filtering
  - block: portfolio
    id: projects
    content:
      title: "Featured Projects"
      subtitle: "A selection of my recent work"
      count: 0
      filters:
        folders:
          - projects
      buttons: []
      # Archive link auto-shown if more projects exist than 'count' above
      # archive:
      #   enable: false  # Set to false to explicitly hide
      #   text: "Browse All"  # Customize text
      #   link: "/work/"  # Custom URL
    design:
      columns: 3
      background:
        color:
          light: "#ffffff"
          dark: "#0d0d12"
      spacing:
        padding: ["4rem", "0", "4rem", "0"]
  
  # Visual Tech Stack - Icons organized by category
  - block: tech-stack
    id: skills
    content:
      title: "Tech Stack"
      subtitle: "Technologies I use to build things"
      categories:
        - name: Languages
          items:
            - name: R
              icon: devicon/r
            - name: Python
              icon: devicon/python
            - name: JavaScript
              icon: devicon/javascript
            - name: SQL
              icon: devicon/azuresqldatabase
        - name: Markup
          items:
            - name: Markdown
              icon: devicon/markdown
            - name: LaTeX
              icon: devicon/latex
            - name: HTML
              icon: devicon/html5
            - name: CSS
              icon: devicon/css3
        - name: Version Control
          items:
            - name: Git
              icon: devicon/git
            - name: GitHub
              icon: devicon/github
            - name: Actions
              icon: devicon/githubactions
            - name: Conda
              icon: devicon/anaconda
        - name: Libraries
          items:
            - name: tidyverse
              icon: custom/tidyverse
            - name: pandas
              icon: devicon/pandas
            - name: NumPy
              icon: devicon/numpy
            - name: Plotly
              icon: devicon/plotly
        - name: IDEs & Editors
          items:
            - name: Colab
              icon: custom/googlecolab
            - name: VS Code
              icon: devicon/vscode
            - name: Jupyter
              icon: devicon/jupyter
            - name: RStudio
              icon: devicon/rstudio
        - name: GIS
          items:
            - name: ArcGIS Pro
              icon: custom/arcgis
            - name: GEE
              icon: custom/gee
            - name: QGIS
              icon: custom/qgis
            - name: GDAL
              icon: custom/gdal
        - name: GIS Tools
          items:
            - name: sf
              icon: custom/sf
            - name: terra
              icon: custom/terra
            - name: GeoPandas
              icon: custom/geopandas
            - name: OSM
              icon: custom/openstreetmap
    design:
      style: grid
      show_levels: false
      background:
        color:
          light: "#f5f5f5"
          dark: "#08080c"
      spacing:
        padding: ["4rem", "0", "4rem", "0"]
  
  # Experience Timeline
  - block: resume-experience
    id: experience
    content:
      title: Experience
      date_format: Jan 2006
      items:
        - title: GIS & Remote Sensing Research Associate
          company: University of Florida
          company_url: ''
          company_logo: ''
          location: Milton, FL
          date_start: '2025-08-01'
          date_end: ''
          description: |2-
            * Led GIS-based analysis assessing spatial patterns and land-use impacts on community and regional risk management
        - title: Graduate Research Assistant
          company: University of Florida
          company_url: ''
          company_logo: ''
          location: Milton, FL
          date_start: '2023-08-01'
          date_end: '2025-08-31'
          description: |2-
            * Conducted geospatial analysis to support wildland-urban interface and emergency management decision-making
        - title: Research Assistant Intern
          company: USDA Agricultural Research Service
          company_url: ''
          company_logo: ''
          location: Miles City, MT
          date_start: '2023-05-01'
          date_end: '2023-08-31'
          description: |2-
            * Collected, cleaned, and validated spatial datasets to support GIS-based risk assessment and land-use planning
        - title: Fire & Recreation Intern
          company: Student Conservation Association/US Forest Service
          company_url: ''
          company_logo: ''
          location: ''
          date_start: '2023-01-01'
          date_end: '2023-05-31'
          description: |2-
            * Applied GIS to support spatial planning and risk assessment for land management projects
        - title: Research Assistant
          company: University of Cincinnati
          company_url: ''
          company_logo: ''
          location: Cincinnati, OH
          date_start: '2022-05-01'
          date_end: '2023-01-31'
          description: |2-
            * Conducted quantitative data analysis for biomedical research using advanced statistical modeling and visualization
        - title: Research Assistant
          company: Northern Kentucky University
          company_url: ''
          company_logo: ''
          location: Highland Heights, KY
          date_start: '2020-02-01'
          date_end: '2022-05-31'
          description: |2-
            * Collected, organized, and analyzed complex ecological datasets using spatial and statistical methods
        - title: Design Consultant
          company: Garage Living
          company_url: ''
          company_logo: ''
          location: Cincinnati, OH
          date_start: '2021-09-01'
          date_end: '2022-06-30'
          description: |2-
            * Developed CAD drawings and project plans for residential remodeling projects
        - title: Elections Clerk
          company: Boone County Clerk's Office
          company_url: ''
          company_logo: ''
          location: Burlington, KY
          date_start: '2017-08-01'
          date_end: '2020-02-28'
          description: |2-
            * Managed and analyzed precinct-level GIS data for voter registration and electoral planning
    design:
      columns: '1'
      background:
        color:
          light: "#ffffff"
          dark: "#0d0d12"
      spacing:
        padding: ["4rem", "0", "4rem", "0"]
  
  # Contact Section
  - block: contact-info
    id: contact
    content:
      title: Get In Touch
      subtitle: "Let's build something amazing together"
      text: |-
        I'm always interested in hearing about new projects and opportunities.
        Whether you're looking to hire, collaborate, or just want to say hi, feel free to reach out!
      email: noah@noahweidig.com
      autolink: true
    design:
      columns: '1'
      background:
        color:
          light: "#ffffff"
          dark: "#0d0d12"
      spacing:
        padding: ["4rem", "0", "4rem", "0"]
  
  # CTA Card
  - block: cta-card
    content:
      title: "Open to Opportunities"
      text: |-
        I'm currently looking for **data scientist** or **GIS analyst** roles.
        
        Let's connect and discuss how I can help your team.
      button:
        text: 'Download Resume'
        url: uploads/resume.pdf
        new_tab: true
    design:
      card:
        # Light mode: soft pastel theme gradient | Dark mode: rich deep gradient
        css_class: 'bg-gradient-to-br from-primary-200 via-primary-100 to-secondary-200 dark:from-primary-600 dark:via-primary-700 dark:to-secondary-700'
        text_color: dark
      background:
        color:
          light: "#f5f5f5"
          dark: "#08080c"
      spacing:
        padding: ["4rem", "0", "6rem", "0"]
---
