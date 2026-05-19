import { Hono } from 'hono'
import type { AppBindings } from '../types'

export const portalRoutes = new Hono<AppBindings>()
