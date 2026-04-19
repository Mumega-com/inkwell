import type { PluginManifest, HonoApp } from '../../kernel/types'
import { courseRoutes } from './routes'

const coursesPlugin: PluginManifest = {
  name: 'courses',
  version: '1.0.0',
  description: 'Course enrollment, progress tracking, drip lessons, and certificates',
  requiredRole: 'member',
  dashboardWidgets: ['CourseOverview'],

  mountRoutes: (app: HonoApp) => {
    app.route('/api/courses', courseRoutes)
  },

  configDefaults: {
    courses: {
      enabled: true,
    },
  },
}

export default coursesPlugin
