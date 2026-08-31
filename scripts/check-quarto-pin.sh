#!/usr/bin/env bash
# Fails if netlify.toml's QUARTO_VERSION has drifted from .quarto-version.
#
# .quarto-version is the single source of truth for every CI workflow (see
# .github/actions/build-site). Netlify builds its own install command from a
# `[build.environment]` variable and cannot read a file to do it, so that one
# copy has to exist — this check is what keeps it honest (#249).
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
pinned="$(tr -d '[:space:]' < "$root/.quarto-version")"
netlify="$(sed -n 's/^ *QUARTO_VERSION *= *"\([^"]*\)".*/\1/p' "$root/netlify.toml")"

if [ -z "$pinned" ]; then
  echo "::error file=.quarto-version::.quarto-version is empty"
  exit 1
fi

if [ "$pinned" != "$netlify" ]; then
  echo "::error file=netlify.toml::QUARTO_VERSION is $netlify but .quarto-version says $pinned."
  echo "Update netlify.toml (and its QUARTO_SHA256, from that release's quarto-<version>-checksums.txt)."
  exit 1
fi

echo "Quarto pin agrees: $pinned"
