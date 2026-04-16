#!/usr/bin/env bash
# install-hooks.sh
#
# Copies the committed hooks from the hooks/ directory into .git/hooks/
# and makes them executable.
#
# Run this once after cloning:
#   ./install-hooks.sh

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
HOOKS_SRC="$REPO_ROOT/hooks"
HOOKS_DEST="$REPO_ROOT/.git/hooks"

if [[ ! -d "$HOOKS_SRC" ]]; then
  echo "ERROR: hooks/ directory not found at $HOOKS_SRC"
  exit 1
fi

INSTALLED=0
for hook in "$HOOKS_SRC"/*; do
  name=$(basename "$hook")
  dest="$HOOKS_DEST/$name"
  cp "$hook" "$dest"
  chmod +x "$dest"
  echo "Installed: .git/hooks/$name"
  INSTALLED=$((INSTALLED + 1))
done

echo ""
echo "$INSTALLED hook(s) installed successfully."
