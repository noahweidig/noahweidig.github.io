<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:atom="http://www.w3.org/2005/Atom">
<xsl:output method="html" encoding="UTF-8" indent="yes"/>
<xsl:template match="/rss/channel">
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title><xsl:value-of select="title"/></title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Newsreader:ital,wght@0,400;0,500;1,400&amp;family=Inter:wght@400;500;600&amp;display=swap');

  :root {
    --c-bg: #07080b;
    --c-surface: #0c0e13;
    --c-raised: #11141b;
    --c-line: #1c202a;
    --c-ink: #e9ecf2;
    --c-dim: #99a1b1;
    --c-faint: #7c8494;
    --c-accent: #3d86ff;
    --c-accent-ink: #6ba4ff;
  }

  * { box-sizing: border-box; }

  body {
    margin: 0;
    background: var(--c-bg);
    color: var(--c-ink);
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif;
    line-height: 1.6;
  }

  a { color: inherit; text-decoration: none; }

  .shell {
    max-width: 46rem;
    margin: 0 auto;
    padding: 3rem 1.25rem 5rem;
  }

  header {
    display: flex;
    align-items: center;
    gap: 0.9rem;
    margin-bottom: 2.5rem;
    padding-bottom: 1.5rem;
    border-bottom: 1px solid var(--c-line);
  }

  header img {
    width: 2.75rem;
    height: 2.75rem;
    border-radius: 0.7rem;
    border: 1px solid var(--c-line);
    background: var(--c-surface);
  }

  header h1 {
    font-family: Newsreader, ui-serif, Georgia, serif;
    font-weight: 500;
    font-size: 1.55rem;
    margin: 0;
    letter-spacing: -0.015em;
  }

  header p {
    margin: 0.15rem 0 0;
    color: var(--c-dim);
    font-size: 0.9rem;
  }

  .kicker {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    font-family: 'JetBrains Mono', ui-monospace, monospace;
    font-size: 0.7rem;
    font-weight: 500;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--c-accent-ink);
    margin: 0 0 1.75rem;
  }

  .feed-desc {
    color: var(--c-dim);
    max-width: 34rem;
    margin: 0 0 2.5rem;
  }

  .item {
    padding: 1.5rem 0;
    border-bottom: 1px solid var(--c-line);
  }
  .item:last-child { border-bottom: none; }

  .item h2 {
    font-family: Newsreader, ui-serif, Georgia, serif;
    font-weight: 500;
    font-size: 1.3rem;
    margin: 0 0 0.4rem;
    letter-spacing: -0.01em;
  }

  .item h2 a:hover { color: var(--c-accent-ink); }

  .item time {
    display: block;
    font-family: 'JetBrains Mono', ui-monospace, monospace;
    font-size: 0.72rem;
    letter-spacing: 0.04em;
    color: var(--c-faint);
    margin-bottom: 0.55rem;
  }

  .item p {
    color: var(--c-dim);
    font-size: 0.95rem;
    margin: 0;
  }

  footer {
    margin-top: 3rem;
    padding-top: 1.5rem;
    border-top: 1px solid var(--c-line);
    color: var(--c-faint);
    font-size: 0.82rem;
  }

  footer a { color: var(--c-accent-ink); }
</style>
</head>
<body>
<div class="shell">
  <header>
    <img src="/favicon-96x96.png" alt=""/>
    <div>
      <h1><xsl:value-of select="title"/></h1>
      <p><xsl:value-of select="link"/></p>
    </div>
  </header>

  <p class="kicker">RSS feed &#8226; <xsl:value-of select="count(item)"/> posts</p>
  <p class="feed-desc"><xsl:value-of select="description"/></p>

  <div class="items">
    <xsl:for-each select="item">
      <article class="item">
        <h2><a href="{link}"><xsl:value-of select="title"/></a></h2>
        <time><xsl:value-of select="pubDate"/></time>
        <p><xsl:value-of select="description"/></p>
      </article>
    </xsl:for-each>
  </div>

  <footer>
    This is an RSS feed. Subscribe by copying the URL from the address bar into your feed reader.
  </footer>
</div>
</body>
</html>
</xsl:template>
</xsl:stylesheet>
