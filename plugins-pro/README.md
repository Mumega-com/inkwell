# Inkwell Pro Plugins

These plugins are developed and maintained by [Mumega Labs](https://mumega.com) and included here for reference. They power the managed Mumega platform.

They work in any Inkwell fork — just add the plugin name to `config.plugins[]` in your `inkwell.config.ts`.

## Plugins

### `agency`
**Agency management** — client registry, onboarding pipeline, cross-client dashboard, per-client reports.

Designed for agencies that manage multiple Inkwell forks on behalf of clients. Provides:
- Client registry with health tracking
- `onboard_client` MCP tool — full onboarding pipeline in one call
- `client_dashboard` — cross-client metrics
- `client_report` — per-client performance reports

### `organism`
**Managed agent provisioning** — provision, configure, and budget AI agents per tenant.

Connects to the [SOS](https://github.com/Mumega-com/sos) agent runtime for managed agent orchestration. Provides:
- `POST /api/organism/activate` — provision a managed agent
- `GET/PUT /api/organism/config` — agent model, tools, MCP servers, budget
- `GET /api/organism/usage` — token + cost history
- Network inter-organism transactions (quote, transact, discover, reputation)

## Usage

```ts
// inkwell.config.ts
export const config = {
  plugins: [
    // ... core plugins
    'agency',    // from plugins-pro/
    'organism',  // from plugins-pro/
  ]
}
```

Mount in your worker:

```ts
// workers/your-api/src/index.ts
import agencyPlugin from '../../../plugins-pro/agency/manifest'
import organismPlugin from '../../../plugins-pro/organism/manifest'
```

## Mumega Managed

The full managed experience — agent squads, memory, economy, multi-tenant onboarding — is available at [mumega.com](https://mumega.com).
