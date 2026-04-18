import type { PluginManifest } from '../../kernel/types'

const coursesPlugin: PluginManifest = {
  name: 'courses',
  version: '1.0.0',
  description: 'Course enrollment, progress tracking, drip lessons, and certificates',
  requiredRole: 'member',

  configDefaults: {
    courses: {
      enabled: true,
    },
  },
}

export default coursesPlugin
