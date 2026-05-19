#!/usr/bin/env bash
# Pre-publish QA script — runs all checks before deploying.
# Usage: npm run qa
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'
FAIL=0

step() { printf "\n${YELLOW}▸ %s${NC}\n" "$1"; }
pass() { printf "  ${GREEN}✓ %s${NC}\n" "$1"; }
fail() { printf "  ${RED}✗ %s${NC}\n" "$1"; FAIL=1; }

step "TypeScript check"
if npx tsc --noEmit 2>/dev/null; then
  pass "No type errors"
else
  fail "TypeScript errors found (run: npx tsc --noEmit)"
fi

step "Build"
if npm run build > /tmp/inkwell-qa-build.log 2>&1; then
  pass "Build succeeded"
else
  fail "Build failed (see /tmp/inkwell-qa-build.log)"
fi

step "Kernel tests"
if npm test > /tmp/inkwell-qa-test.log 2>&1; then
  pass "All kernel tests pass"
else
  fail "Kernel tests failed (see /tmp/inkwell-qa-test.log)"
fi

step "Dist output"
if [ -d "dist" ]; then
  PAGE_COUNT=$(find dist -name '*.html' | wc -l)
  pass "dist/ exists — ${PAGE_COUNT} HTML pages"
else
  fail "dist/ directory not found after build"
fi

step "No console.log in plugins"
LOG_COUNT=$(grep -r 'console\.log' plugins/ --include='*.ts' --include='*.tsx' -l 2>/dev/null | wc -l)
if [ "$LOG_COUNT" -eq 0 ]; then
  pass "No console.log in plugins/"
else
  fail "${LOG_COUNT} files have console.log in plugins/"
  grep -r 'console\.log' plugins/ --include='*.ts' --include='*.tsx' -l 2>/dev/null | head -5 | while read f; do
    printf "    %s\n" "$f"
  done
fi

step "No hardcoded domains in plugins"
DOMAIN_HITS=$(grep -rE '(mumega\.com|digid\.ca|grantandfunding\.com)' plugins/ --include='*.ts' --include='*.tsx' -l 2>/dev/null | wc -l)
if [ "$DOMAIN_HITS" -eq 0 ]; then
  pass "No hardcoded domains"
else
  fail "${DOMAIN_HITS} files have hardcoded domains"
  grep -rE '(mumega\.com|digid\.ca|grantandfunding\.com)' plugins/ --include='*.ts' --include='*.tsx' -l 2>/dev/null | head -5 | while read f; do
    printf "    %s\n" "$f"
  done
fi

step "Kernel size"
KERNEL_LINES=$(cat kernel/types.ts kernel/plugin-loader.ts kernel/adapter-registry.ts kernel/roles.ts kernel/theme.ts 2>/dev/null | wc -l)
if [ "$KERNEL_LINES" -le 800 ]; then
  pass "Kernel is ${KERNEL_LINES} lines (limit: 800)"
else
  fail "Kernel is ${KERNEL_LINES} lines — exceeds 800 line budget"
fi

step "Plugin cross-imports"
CROSS=$(grep -rE "from ['\"]\.\./(auth|content|crm|agency|analytics|dashboard|commerce|seo|media|feedback)" plugins/ --include='*.ts' --include='*.tsx' -l 2>/dev/null | wc -l)
if [ "$CROSS" -eq 0 ]; then
  pass "No cross-plugin imports"
else
  fail "${CROSS} files import from other plugins"
  grep -rE "from ['\"]\.\./(auth|content|crm|agency|analytics|dashboard|commerce|seo|media|feedback)" plugins/ --include='*.ts' --include='*.tsx' -l 2>/dev/null | head -5 | while read f; do
    printf "    %s\n" "$f"
  done
fi

echo ""
if [ "$FAIL" -eq 0 ]; then
  printf "${GREEN}All QA checks passed.${NC}\n"
else
  printf "${RED}Some QA checks failed — fix before publishing.${NC}\n"
  exit 1
fi
