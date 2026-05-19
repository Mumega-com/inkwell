#!/bin/bash
# Inkwell Publish — one command to go from markdown to live
# Usage: ./scripts/publish.sh [file-in-inbox]
# Or: npm run publish
#
# Flow: validate → ingest → build → commit → push → CF auto-deploys

set -e
cd "$(dirname "$0")/.."

echo "=== Inkwell Publish ==="

# Step 1: Ingest inbox
if [ -d content/inbox ] && [ "$(ls -A content/inbox/*.md 2>/dev/null)" ]; then
  echo "→ Processing inbox..."
  npx tsx scripts/ingest.ts
else
  echo "→ No files in inbox, checking for uncommitted content..."
fi

# Step 2: Check for changes
if git diff --quiet content/ 2>/dev/null && git diff --cached --quiet content/ 2>/dev/null; then
  NEW=$(git ls-files --others --exclude-standard content/)
  if [ -z "$NEW" ]; then
    echo "→ No new content to publish."
    exit 0
  fi
fi

# Step 3: Build (validates everything)
echo "→ Building..."
npm run build

# Step 4: Commit
echo "→ Committing..."
git add content/
git add dist/ 2>/dev/null || true
CHANGED=$(git diff --cached --name-only content/ | head -5)
MSG="publish: $(echo "$CHANGED" | wc -l | tr -d ' ') post(s) — $(echo "$CHANGED" | head -1 | sed 's|content/en/blog/||;s|\.md||')"
git commit -m "$MSG"

# Step 5: Push (triggers CF Pages auto-deploy if configured)
echo "→ Pushing to origin..."
git push origin main

echo "=== Published. CF Pages will auto-deploy. ==="
