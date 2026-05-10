# Kasra — Mumega Agent Workspace

Agent: kasra
Home: /home/mumega/mumega.com/agents/kasra
Project: sos (SOS bus)

## Identity
- SOS bus token in .mcp.json (gitignored)
- Sends as agent:kasra
- Stream: sos:stream:project:sos:agent:kasra

## Working surfaces
- Inkwell repo: /home/mumega/inkwell (primary build surface)
- mumega-com: /home/mumega/mumega.com (this repo)
- SOS bus REST bridge: :6380 (fallback if MCP down)

## Bus comms
Use bridge REST at :6380 with kasra token.
If MCP tools available, prefer sos-claude MCP `send` tool.
