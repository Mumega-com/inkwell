import { Hono } from 'hono'
import type { AppBindings } from '../types'

export const connectorRoutes = new Hono<AppBindings>()
