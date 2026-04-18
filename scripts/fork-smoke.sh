#!/usr/bin/env bash
#
# Fork smoke test — proves Inkwell builds with config-only changes.
#
# Modifies inkwell.config.ts in place with test values, runs `npm run build`,
# then restores the original. Exit 0 = pass, exit 1 = fail.
#
# Usage: bash scripts/fork-smoke.sh
#
set -euo pipefail

INKWELL_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CONFIG="$INKWELL_ROOT/inkwell.config.ts"
BACKUP="$INKWELL_ROOT/inkwell.config.ts.smoke-backup"
PASSED=false

cleanup() {
  if [ -f "$BACKUP" ]; then
    cp "$BACKUP" "$CONFIG"
    rm -f "$BACKUP"
    echo "[restore] Original inkwell.config.ts restored."
  fi
}

# Always restore config on exit, even on failure or interrupt
trap cleanup EXIT

echo "=== Inkwell Fork Smoke Test ==="
echo "Root: $INKWELL_ROOT"
echo ""

# 1. Back up the original config
echo "[1/4] Backing up inkwell.config.ts..."
cp "$CONFIG" "$BACKUP"

# 2. Modify config with test fork values
echo "[2/4] Writing fork test config..."
sed -i "s/name: '.*'/name: 'ForkSmokeTest'/" "$CONFIG"
sed -i "s/domain: '.*'/domain: 'smoke.example.com'/" "$CONFIG"
sed -i "s/tagline: '.*'/tagline: 'Smoke test fork instance.'/" "$CONFIG"

# Verify the substitution happened
if ! grep -q "ForkSmokeTest" "$CONFIG"; then
  echo "FAIL — sed did not update the config. Check inkwell.config.ts format."
  exit 1
fi

echo "       name    -> ForkSmokeTest"
echo "       domain  -> smoke.example.com"
echo "       tagline -> Smoke test fork instance."

# 3. Run the build
echo "[3/4] Running npm run build..."
cd "$INKWELL_ROOT"
if npm run build 2>&1; then
  PASSED=true
fi

# 4. Report
echo ""
if [ "$PASSED" = true ]; then
  echo "PASS — Fork builds successfully with config-only changes."
  exit 0
else
  echo "FAIL — Build failed with fork config. Check output above."
  exit 1
fi
