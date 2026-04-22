# Loom — Mumega Agent Workspace

Agent: loom (Loom_sos_001)
Home: /home/mumega/mumega.com/agents/loom
Project: sos (SOS bus)

## Identity
- SOS bus token in .mcp.json (gitignored)
- Sends as agent:loom
- Stream: sos:stream:project:sos:agent:loom

## Working surfaces
- SOS repo: /mnt/HC_Volume_104325311/SOS
- mumega-com: /home/mumega/mumega.com (this repo)
- Memory: /home/mumega/.claude/projects/

## Bus comms
Send via sos-claude MCP `send` tool or bridge REST at :6380.
Use `sk-loom-*` token for bridge REST if MCP not available.
