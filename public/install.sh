#!/bin/bash
# Inkwell starter helper.
#
# Usage:
#   curl -sL https://example.com/install.sh | bash
#
# Prefer the published package when available:
#   npx create-inkwell my-site

set -euo pipefail

PROJECT_NAME="${INKWELL_PROJECT_NAME:-my-inkwell-site}"
DOMAIN="${INKWELL_DOMAIN:-example.com}"

echo ""
echo "Inkwell — forkable agent-first publishing"
echo ""
echo "Recommended setup:"
echo "  npx create-inkwell ${PROJECT_NAME} --domain ${DOMAIN}"
echo ""
echo "Then:"
echo "  cd ${PROJECT_NAME}"
echo "  npm install"
echo "  npm run dev"
echo ""
echo "Configure your site in inkwell.config.ts and Worker bindings in workers/inkwell-api/wrangler.toml."
echo ""
