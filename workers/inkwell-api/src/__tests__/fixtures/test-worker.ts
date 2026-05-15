import { Hono } from 'hono'

import { bountyRoutes } from '../../../../../plugins/bounty/routes'
import { adapterMiddleware } from '../../middleware/adapters'
import { tenantResolver } from '../../middleware/tenant'
import { usageTracker } from '../../middleware/usage'
import { mcpRoutes } from '../../routes/mcp'
import type { AppBindings } from '../../types'

const app = new Hono<AppBindings>()

app.use('*', adapterMiddleware)
app.use('*', tenantResolver())
app.use('*', usageTracker())

app.route('/mcp', mcpRoutes)
app.route('/api/bounties', bountyRoutes)

export default app
