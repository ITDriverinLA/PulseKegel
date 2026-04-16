#!/usr/bin/env bash
# validate-blog-dates.sh
#
# Verifies that every blog-content/*.html file (excluding index.html) has a
# <!--lastmod:YYYY-MM-DD--> comment on its first line whose date is >= today.
#
# NOTE: This script reads files from the WORKING TREE (disk). It is intended
# for manual audits and CI runs where the working tree matches what will be
# committed. The git pre-commit hook (hooks/pre-commit) reads from the git
# INDEX (staged blobs) instead, which is correct for partial-staging safety.
#
# Dates are compared using UTC so the result is consistent regardless of the
# developer's local timezone.
#
# Usage:
#   ./validate-blog-dates.sh              # checks all blog-content/*.html
#   ./validate-blog-dates.sh [file ...]   # checks only the given files
#
# Exit codes:
#   0  All files are up-to-date
#   1  One or more files have a stale or missing lastmod date

set -euo pipefail

TODAY=$(date -u +%F)   # YYYY-MM-DD in UTC
ERRORS=0

check_file() {
  local file="$1"
  local basename
  basename=$(basename "$file")

  # skip the blog index page
  if [[ "$basename" == "index.html" ]]; then
    return
  fi

  local first_line
  first_line=$(head -1 "$file")

  # extract the date from <!--lastmod:YYYY-MM-DD-->
  if [[ "$first_line" =~ ^'<!--lastmod:'([0-9]{4}-[0-9]{2}-[0-9]{2})'-->'$ ]]; then
    local lastmod="${BASH_REMATCH[1]}"
    if [[ "$lastmod" < "$TODAY" ]]; then
      echo "ERROR: $file"
      echo "       lastmod ($lastmod) is older than today ($TODAY)."
      echo "       Update the <!--lastmod:--> comment (and dateModified in JSON-LD) to $TODAY."
      ERRORS=$((ERRORS + 1))
    else
      echo "OK:    $file  (lastmod: $lastmod)"
    fi
  else
    echo "ERROR: $file"
    echo "       Missing or malformed <!--lastmod:YYYY-MM-DD--> on line 1."
    echo "       Add  <!--lastmod:$TODAY-->  as the very first line."
    ERRORS=$((ERRORS + 1))
  fi
}

if [[ $# -gt 0 ]]; then
  # validate only the files passed as arguments
  for f in "$@"; do
    check_file "$f"
  done
else
  # validate all blog content files
  BLOG_DIR="$(dirname "$0")/blog-content"
  if [[ ! -d "$BLOG_DIR" ]]; then
    echo "ERROR: blog-content directory not found at $BLOG_DIR"
    exit 1
  fi
  for f in "$BLOG_DIR"/*.html; do
    check_file "$f"
  done
fi

if [[ $ERRORS -gt 0 ]]; then
  echo ""
  echo "FAILED: $ERRORS file(s) have stale or missing lastmod dates."
  echo "Update the <!--lastmod:--> comment on line 1 and the dateModified"
  echo "field in the JSON-LD block to today's date ($TODAY), then re-stage."
  exit 1
fi

echo ""
echo "All blog lastmod dates are up-to-date."
