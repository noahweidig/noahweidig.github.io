import type { APIRoute, GetStaticPaths } from 'astro';

/**
 * Redirect stubs for the pages Quarto rendered as `<name>.html`. They are
 * directory routes now (`/contact/`), so the old paths forward there.
 */
const MOVED = ['contact', 'cv', 'privacy'];

export const getStaticPaths = (() =>
  MOVED.map((page) => ({ params: { page } }))) satisfies GetStaticPaths;

export const GET: APIRoute = ({ params }) => {
  const to = `/${params.page}/`;
  return new Response(
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Redirecting…</title>
    <link rel="canonical" href="https://noahweidig.com${to}" />
    <meta http-equiv="refresh" content="0; url=${to}" />
    <meta name="robots" content="noindex" />
  </head>
  <body>
    <p>This page has moved to <a href="${to}">${to}</a>.</p>
    <script>
      location.replace('${to}' + location.search + location.hash);
    </script>
  </body>
</html>
`,
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  );
};
