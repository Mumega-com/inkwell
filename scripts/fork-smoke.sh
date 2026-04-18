#!/usr/bin/env bash
#
# Fork smoke test — proves Inkwell can be forked with config-only changes.
#
# Usage: ./scripts/fork-smoke.sh [target-dir]
# Default target: /tmp/inkwell-fork-test
#
set -euo pipefail

INKWELL_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TARGET="${1:-/tmp/inkwell-fork-test}"

echo "=== Inkwell Fork Smoke Test ==="
echo "Source: $INKWELL_ROOT"
echo "Target: $TARGET"
echo ""

# Clean previous test
rm -rf "$TARGET"
mkdir -p "$TARGET"

# Copy the forkable structure
echo "[1/5] Copying kernel, plugins, worker..."
cp -r "$INKWELL_ROOT/kernel" "$TARGET/kernel"
cp -r "$INKWELL_ROOT/plugins" "$TARGET/plugins"
cp -r "$INKWELL_ROOT/workers" "$TARGET/workers"
cp "$INKWELL_ROOT/package.json" "$TARGET/package.json"
cp "$INKWELL_ROOT/tsconfig.json" "$TARGET/tsconfig.json" 2>/dev/null || true

# Write a minimal fork config
echo "[2/5] Writing fork inkwell.config.ts..."
cat > "$TARGET/inkwell.config.ts" << 'FORKEOF'
export const config = {
  name: 'ForkTest',
  domain: 'forktest.example.com',
  tagline: 'A fork smoke test instance.',
  theme: {
    colors: {
      primary: '#FF5733',
      secondary: '#1A1D23',
      accent: '#06B6D4',
      danger: '#EF4444',
      bg:      { dark: '#0A0A10', light: '#FAFBFC' },
      surface: { dark: '#151519', light: '#FFFFFF' },
      text:    { dark: '#EDEDF0', light: '#1A1D23' },
      muted:   { dark: 'rgba(255,255,255,0.55)', light: 'rgba(0,0,0,0.55)' },
      dim:     { dark: 'rgba(255,255,255,0.35)', light: 'rgba(0,0,0,0.35)' },
      border:  { dark: 'rgba(255,255,255,0.10)', light: 'rgba(0,0,0,0.10)' },
    },
    fonts: {
      display: "'Inter', sans-serif",
      body: "'DM Sans', system-ui, sans-serif",
      mono: "'JetBrains Mono', monospace",
    },
    radius: '8px',
    contentWidth: '680px',
    pageWidth: '1200px',
    darkFirst: true,
  },
  i18n: { defaultLang: 'en' as const, languages: ['en'] as const, rtl: [] as const, fallback: 'en' as const },
  features: { reactions: false, newsletter: false, readingProgress: false, toc: false, shareButtons: false, commandPalette: false, knowledgeGraph: false, rss: false, search: false, darkModeToggle: true },
  analytics: { googleAnalytics: '', clarity: '', hotjar: '', tagManager: '', plausible: '' },
  seo: { organization: { name: 'ForkTest', url: 'https://forktest.example.com', logo: '/logo.svg', knowsAbout: [] }, defaultAuthor: { name: 'ForkTest', url: 'https://forktest.example.com' } },
  workerUrl: '',
  publish: { inbox: false, api: true, mcp: true },
  brand: { voice: 'test', logo: '/logo.svg', favicon: '/favicon.svg', ogImage: '/og-default.png', teamNames: {} as Record<string, string>, statusLabels: {} as Record<string, string>, priorityLabels: {} as Record<string, string>, counterpartyNames: {} as Record<string, string> },
  plugins: ['analytics', 'auth', 'dashboard', 'content', 'mcp'],
} as const

export type InkwellConfig = typeof config
FORKEOF

# Install dependencies
echo "[3/5] Installing dependencies..."
cd "$TARGET"
npm install --ignore-scripts 2>&1 | tail -3

# Update wrangler.toml for fork
echo "[4/5] Updating wrangler.toml..."
sed -i 's/name = ".*"/name = "forktest-api"/' workers/inkwell-api/wrangler.toml
sed -i 's|SITE_URL = ".*"|SITE_URL = "https://forktest.example.com"|' workers/inkwell-api/wrangler.toml

# Build
echo "[5/5] Building Worker (dry-run)..."
cd workers/inkwell-api
npx wrangler deploy --dry-run --outdir=.wrangler/tmp 2>&1 | tail -5

BUILD_EXIT=$?

echo ""
if [ $BUILD_EXIT -eq 0 ]; then
  echo "PASS — Fork builds successfully with config-only changes."
else
  echo "FAIL — Fork build failed. Check output above."
  exit 1
fi

# Cleanup
rm -rf "$TARGET"
echo "Cleaned up $TARGET"
