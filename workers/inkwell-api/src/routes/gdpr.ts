import { Hono } from 'hono'
import type { AppBindings } from '../types'

export const gdprRoutes = new Hono<AppBindings>()
