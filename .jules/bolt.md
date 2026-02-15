## 2024-05-21 - Hugo Environment Limitations
**Learning:** The development environment lacks the `hugo` binary in the system PATH, despite `package.json` scripts relying on it. `npm run build` fails.
**Action:** Do not rely on running `hugo` commands for verification. Rely on code analysis and configuration validation.

## 2026-05-23 - Netlify Headers Optimization
**Learning:** Hugo Blox uses `layouts/index.headers` to generate `_headers` for Netlify, making it the central place for configuring HTTP headers like CSP and Preconnect.
**Action:** Check `layouts/index.headers` for header optimizations instead of `netlify.toml` or `config.toml`.
