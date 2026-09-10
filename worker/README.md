# AI search Worker

Answers `POST noahweidig.com/api/ai-search` with a two-sentence answer and up to
three cited page indices, using Groq's `openai/gpt-oss-20b`. The search dialog's
own engines (Pagefind, fuzzy title index) do not go through here and do not wait
on it.

## Why there is no vector database

The whole site catalog is 79 records, about 18 KB, roughly 6k tokens. It fits in
one prompt, so there is no retrieval step to build: the model sees every page on
the site on every call. Trimming descriptions to 140 chars and dropping tags
brings the prefix to ~4k tokens, and Groq caches that prefix automatically for
two hours at half the input rate.

## Setup

```sh
cd worker
npm install
echo 'GROQ_API_KEY=gsk_...' > .dev.vars      # gitignored
npm run dev                                   # fetches the catalog, serves :8788
```

`npm run dev` and `npm run deploy` both run `scripts/fetch-catalog.mjs` first,
which pulls the live `/search-index.json` into the gitignored
`src/catalog.json` and refuses to write a catalog of fewer than 50 documents.

Production secret, once:

```sh
npx wrangler secret put GROQ_API_KEY
```

## Degrade table

Everything except 200 means "no AI for this query". The client hides the panel
and never renders an error.

| Code             | Meaning                                | Client                       |
| ---------------- | -------------------------------------- | ---------------------------- |
| 204              | model returned nothing usable          | hide panel, no retry         |
| 400              | query empty, too long, or letterless   | hide panel                   |
| 403              | origin not allowed                     | disable AI for the page load |
| 429              | rate limited (10 req / 10 s per IP)    | hide panel                   |
| 503              | `GROQ_API_KEY` not bound               | disable AI for the page load |
| 404, or non-JSON | no Worker (localhost, Netlify preview) | disable AI for the page load |

## The limit that actually binds: tokens per minute

Measured on a free Groq key:

```
x-ratelimit-limit-requests: 1000      # per day
x-ratelimit-limit-tokens:   8000      # per minute
```

The prompt is ~3,300 tokens, so a free key supports **two calls per minute**
site-wide, then refuses with 429 until the bucket refills. Requests per day are
not the problem; tokens per minute are. Two consequences:

- **Raise the Groq tier before this sees real traffic.** Everything still works
  on a free key, it just throttles, and a throttled query shows no panel.
- The two defences against the throttle are load-bearing, not optimisations: the
  client only calls when local search did _not_ already answer the query (see
  `AI_STRONG_HIT` in `src/scripts/ui.ts`), and a 429 from Groq puts this Worker
  in a cooldown so the next queries fail in microseconds instead of spending a
  request to rediscover the same 429.

## Cost

About $0.0005 per uncached call at $0.075/M input and $0.30/M output, halved on
the cached prefix. The ceiling that actually binds the bill is the spend cap in
the Groq dashboard; set one.

Note: `x-groq-cached-tokens` has read 0 on every response so far, including
repeated calls inside the two-hour window. The prompt is above the documented
minimum and the static content is first, so the ordering is right; Groq may
simply not be reporting `prompt_tokens_details` on this account. Treat the
50% cached-input discount as unconfirmed rather than as a budgeted saving.

## Checks

```sh
curl -s localhost:8788/api/health | jq
curl -s -X POST localhost:8788/api/ai-search \
  -H 'origin: https://noahweidig.com' -H 'content-type: application/json' \
  -d '{"q":"how does he model wildfire spread"}' | jq
```

`x-groq-cached-tokens` on the response should be non-zero on a second distinct
query within two hours, which is the proof that the static prefix is ordered
correctly for Groq's cache.
