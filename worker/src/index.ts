/**
 * OAuth code-exchange endpoint for /blog/write.
 *
 * GitHub OAuth Apps don't support PKCE, so the `client_secret` step of the
 * authorization-code flow can't happen in the browser — this Worker is that
 * step. It takes the `code` GitHub redirected back with, exchanges it
 * server-side for an access token, and returns the token to the page. The
 * token itself is bearer-usable by anyone who has it; this Worker does not
 * scope or store it.
 */

export interface Env {
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  /** Comma-separated list of origins allowed to call this Worker. */
  ALLOWED_ORIGINS: string;
}

function corsHeaders(origin: string | null, env: Env): HeadersInit {
  const allowed = env.ALLOWED_ORIGINS.split(',').map((o) => o.trim());
  const allowOrigin = origin && allowed.includes(origin) ? origin : allowed[0];
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin',
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin');
    const headers = corsHeaders(origin, env);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers });
    }

    const url = new URL(request.url);
    if (url.pathname !== '/exchange') {
      return new Response('Not found', { status: 404, headers });
    }

    let code: string | undefined;
    try {
      ({ code } = (await request.json()) as { code?: string });
    } catch {
      return new Response(JSON.stringify({ error: 'invalid_json' }), {
        status: 400,
        headers: { ...headers, 'Content-Type': 'application/json' },
      });
    }

    if (!code || typeof code !== 'string') {
      return new Response(JSON.stringify({ error: 'missing_code' }), {
        status: 400,
        headers: { ...headers, 'Content-Type': 'application/json' },
      });
    }

    const upstream = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: env.GITHUB_CLIENT_ID,
        client_secret: env.GITHUB_CLIENT_SECRET,
        code,
      }),
    });

    const data = await upstream.json<{
      access_token?: string;
      error?: string;
      error_description?: string;
    }>();

    if (!upstream.ok || data.error || !data.access_token) {
      return new Response(
        JSON.stringify({
          error: data.error ?? 'exchange_failed',
          description: data.error_description,
        }),
        { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } },
      );
    }

    return new Response(JSON.stringify({ access_token: data.access_token }), {
      status: 200,
      headers: { ...headers, 'Content-Type': 'application/json' },
    });
  },
};
