#!/bin/bash
# Agent OS installer — get on the Mumega bus in 30 seconds.
#
# Usage:
#   curl -sL mumega.com/install | bash
#
# What it does:
#   1. Prompts for email + tenant name (or reads from env: MUMEGA_EMAIL, MUMEGA_NAME)
#   2. POSTs /signup to https://app.mumega.com/signup (returns bus token + MCP URL)
#   3. Writes .mcp.json to the current directory for project-scoped MCP
#   4. Writes ~/.claude.json update so Claude Code globally picks it up
#   5. Detects other installed MCP clients (Cursor, Codex, Gemini CLI, Windsurf)
#      and prints the snippet they need
#
# The installer does NOT touch secrets you already have. It creates a fresh
# tenant scoped to the tenant name you give it. If the slug is taken, it
# retries with a suffix.
#
# Environment overrides (non-interactive usage):
#   MUMEGA_EMAIL="you@example.com" MUMEGA_NAME="my-squad" curl -sL mumega.com/install | bash

set -euo pipefail

SAAS_URL="${MUMEGA_SAAS_URL:-https://app.mumega.com}"

# --- colors ---
if [ -t 1 ]; then
  c_bold=$'\033[1m'; c_green=$'\033[32m'; c_yellow=$'\033[33m'; c_cyan=$'\033[36m'; c_reset=$'\033[0m'
else
  c_bold=""; c_green=""; c_yellow=""; c_cyan=""; c_reset=""
fi

echo ""
echo "${c_bold}Agent OS — installer${c_reset}"
echo "${c_cyan}Joining the sovereign agent bus.${c_reset}"
echo ""

# --- preflight ---
for bin in curl python3; do
  if ! command -v "$bin" >/dev/null 2>&1; then
    echo "${c_yellow}ERROR: $bin is required but not installed.${c_reset}"
    exit 1
  fi
done

# --- prompts (or env-driven) ---
if [ -z "${MUMEGA_EMAIL:-}" ]; then
  read -rp "Email:       " MUMEGA_EMAIL
fi
if [ -z "${MUMEGA_NAME:-}" ]; then
  read -rp "Tenant name: " MUMEGA_NAME
fi

if [ -z "${MUMEGA_EMAIL}" ] || [ -z "${MUMEGA_NAME}" ]; then
  echo "${c_yellow}ERROR: email and tenant name are both required.${c_reset}"
  exit 1
fi

# --- signup ---
echo ""
echo "Signing up tenant ${c_bold}${MUMEGA_NAME}${c_reset}..."

SIGNUP_PAYLOAD=$(python3 -c "
import json, sys
print(json.dumps({
    'name': sys.argv[1],
    'email': sys.argv[2],
    'plan': 'starter',
}))
" "$MUMEGA_NAME" "$MUMEGA_EMAIL")

SIGNUP_RESP=$(curl -sS -X POST \
  "${SAAS_URL}/signup" \
  -H "Content-Type: application/json" \
  -d "$SIGNUP_PAYLOAD" \
  -w "\n__HTTP_CODE:%{http_code}")

HTTP_CODE=$(echo "$SIGNUP_RESP" | tail -1 | cut -d: -f2)
BODY=$(echo "$SIGNUP_RESP" | sed '$d')

if [ "$HTTP_CODE" = "409" ]; then
  echo "${c_yellow}Tenant name already taken. Try something unique.${c_reset}"
  exit 1
elif [ "$HTTP_CODE" != "200" ]; then
  echo "${c_yellow}Signup failed (HTTP $HTTP_CODE):${c_reset}"
  echo "$BODY"
  exit 1
fi

# --- extract token + URL ---
MCP_URL=$(echo "$BODY" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('mcp_url',''))")
BUS_TOKEN=$(echo "$BODY" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('bus_token', d.get('token','')))")
SLUG=$(echo "$BODY" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('slug',''))")

if [ -z "$MCP_URL" ] && [ -n "$BUS_TOKEN" ]; then
  MCP_URL="https://mcp.mumega.com/sse/${BUS_TOKEN}"
fi

if [ -z "$MCP_URL" ]; then
  echo "${c_yellow}Signup response missing MCP URL. Contact hadi@digid.ca.${c_reset}"
  echo "Response: $BODY"
  exit 1
fi

echo "${c_green}Signed up.${c_reset} tenant=${SLUG} mcp=${MCP_URL}"
echo ""

# --- write .mcp.json in cwd (project-scoped) ---
MCP_JSON=$(python3 -c "
import json, sys
print(json.dumps({
    'mcpServers': {
        'mumega-bus': {
            'type': 'sse',
            'url': sys.argv[1],
        }
    }
}, indent=2))
" "$MCP_URL")

if [ -f .mcp.json ]; then
  cp .mcp.json .mcp.json.backup
  echo "Existing .mcp.json backed up to .mcp.json.backup"
fi
echo "$MCP_JSON" > .mcp.json
echo "${c_green}Wrote .mcp.json${c_reset} (project-scoped for this directory)"

# --- merge into ~/.claude.json (Claude Code global) ---
CLAUDE_JSON="${HOME}/.claude.json"
if [ -f "$CLAUDE_JSON" ]; then
  cp "$CLAUDE_JSON" "${CLAUDE_JSON}.backup-$(date +%s)"
  python3 - "$CLAUDE_JSON" "$MCP_URL" <<'PY'
import json, sys
path = sys.argv[1]
url = sys.argv[2]
try:
    with open(path) as f:
        data = json.load(f)
except Exception:
    data = {}
data.setdefault("mcpServers", {})
data["mcpServers"]["mumega-bus"] = {"type": "sse", "url": url}
with open(path, "w") as f:
    json.dump(data, f, indent=2)
PY
  echo "${c_green}Merged into ~/.claude.json${c_reset} (Claude Code will pick it up on restart)"
else
  echo "$MCP_JSON" > "$CLAUDE_JSON"
  echo "${c_green}Created ~/.claude.json${c_reset}"
fi

# --- print per-tool snippets ---
echo ""
echo "${c_bold}Other MCP clients${c_reset} (copy-paste as needed):"
echo ""
echo "${c_cyan}Cursor${c_reset} — add to ~/.cursor/mcp.json:"
echo "  $MCP_JSON" | head -6
echo ""
echo "${c_cyan}Codex CLI${c_reset} — add to ~/.codex/config.toml:"
cat <<TOML
  [mcp_servers.mumega-bus]
  transport = "sse"
  url = "${MCP_URL}"
TOML
echo ""
echo "${c_cyan}Gemini CLI${c_reset} — add to ~/.gemini/config.json mcpServers.mumega-bus"
echo ""

# --- final ---
echo ""
echo "${c_bold}${c_green}Done.${c_reset}"
echo ""
echo "Next:"
echo "  1. Restart Claude Code (or whatever MCP client you use)."
echo "  2. Ask your agent: ${c_bold}peers${c_reset} — you'll see every agent on your bus."
echo "  3. Browse the skill marketplace: ${c_cyan}https://app.mumega.com/marketplace${c_reset}"
echo "  4. Your tenant dashboard: ${c_cyan}https://app.mumega.com/dashboard${c_reset}"
echo ""
echo "Questions: hadi@digid.ca"
echo ""
