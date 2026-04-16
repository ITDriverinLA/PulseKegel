#!/usr/bin/env bash
# ci-validate-blog.sh
#
# CI wrapper for validate-blog-dates.sh.
# Finds blog-content/*.html files that changed since the previous commit
# (or, in a dirty working tree, files that are staged or modified) and
# validates their <!--lastmod:YYYY-MM-DD--> dates against today's UTC date.
#
# Skips validation entirely when no blog HTML files are in the changeset.
#
# Exit codes:
#   0  No blog files changed, or all changed files have up-to-date dates
#   1  One or more changed files have a stale or missing lastmod date

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
VALIDATOR="$SCRIPT_DIR/validate-blog-dates.sh"

if [[ ! -x "$VALIDATOR" ]]; then
  chmod +x "$VALIDATOR"
fi

# ── Collect changed blog files ────────────────────────────────────────────────
# 1. Files staged for the next commit (git index vs HEAD)
# 2. Files modified in the last commit (HEAD vs HEAD~1) — catches CI pipelines
#    that clone and validate after the commit has been made
#
# We union both sets and deduplicate.

STAGED=$(git diff --name-only --diff-filter=AM HEAD -- 'blog-content/*.html' 2>/dev/null || true)
LAST_COMMIT=""

if git rev-parse HEAD~1 &>/dev/null; then
  LAST_COMMIT=$(git diff --name-only --diff-filter=AM HEAD~1..HEAD -- 'blog-content/*.html' 2>/dev/null || true)
fi

# Combine, sort, deduplicate, skip index.html
CHANGED=$(printf '%s\n%s\n' "$STAGED" "$LAST_COMMIT" \
  | sort -u \
  | grep -v '^$' \
  | grep -v 'blog-content/index\.html' \
  || true)

if [[ -z "$CHANGED" ]]; then
  echo "No blog HTML files in the changeset — skipping date validation."
  exit 0
fi

echo "Validating lastmod dates for changed blog files:"
echo "$CHANGED" | sed 's/^/  /'
echo ""

# Run the validator on just the changed files
ERRORS=0
while IFS= read -r f; do
  [[ -z "$f" ]] && continue
  if ! "$VALIDATOR" "$f"; then
    ERRORS=$((ERRORS + 1))
  fi
done <<< "$CHANGED"

if [[ $ERRORS -gt 0 ]]; then
  exit 1
fi
