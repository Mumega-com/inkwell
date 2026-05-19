#!/bin/bash
set -euo pipefail

VAULT_DIR="${1:-./content/en}"

if [ ! -d "$VAULT_DIR" ]; then
  echo "Vault directory not found: $VAULT_DIR" >&2
  exit 1
fi

if command -v obsidian >/dev/null 2>&1; then
  exec obsidian "$VAULT_DIR"
fi

if command -v xdg-open >/dev/null 2>&1; then
  exec xdg-open "$VAULT_DIR"
fi

echo "$VAULT_DIR"
