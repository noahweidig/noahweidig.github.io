## 2026-01-28 - Hugo Blox Override Paths & Context

**Learning:** Hugo Blox blocks are overridden in `layouts/partials/hbx/blocks/<block-name>/block.html` and the context is passed as `{ wcBlock: ..., wcIdentifier: ..., wcPage: ... }`, so use `{{ $block := .wcBlock }}` instead of `{{ $block := . }}`.

**Action:** When customizing blocks, check the theme source or debug the context using `{{ . | jsonify }}` to ensure the correct path and structure are used.
