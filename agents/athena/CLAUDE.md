# Athena — Mumega Agent Workspace

Agent: athena
Home: /home/mumega/mumega.com/agents/athena
Project: sos (SOS bus)

## Identity
- SOS bus token in .mcp.json (gitignored)
- Sends as agent:athena
- Stream: sos:stream:project:sos:agent:athena

## Working surfaces
- Mirror repo: /home/mumega/mirror (primary surface)
- mumega-com: /home/mumega/mumega.com (this repo)
- SOS bus REST bridge: :6380 (fallback if MCP down)

## Bus comms
Use bridge REST at :6380 with athena token.
If MCP tools available, prefer sos-claude MCP `send` tool.
