import { Hono } from 'hono'
import type { AppBindings } from '../types'

export const identityRoutes = new Hono<AppBindings>()
