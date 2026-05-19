import { describe, it, expect, beforeEach } from 'vitest'
import {
  registerPlugin,
  getPlugin,
  getAllPlugins,
  getActivePlugins,
  collectMcpTools,
  collectDashboardWidgets,
  mergePluginConfigs,
  clearPlugins,
} from '../plugin-loader'
import type { PluginManifest } from '../types'

function makePlugin(overrides: Partial<PluginManifest> & { name: string }): PluginManifest {
  return {
    version: '1.0.0',
    description: `${overrides.name} plugin`,
    ...overrides,
  }
}

describe('plugin-loader', () => {
  beforeEach(() => {
    clearPlugins()
  })

  describe('registerPlugin / getPlugin', () => {
    it('registers and retrieves a plugin', () => {
      const p = makePlugin({ name: 'analytics' })
      registerPlugin(p)
      expect(getPlugin('analytics')).toBe(p)
    })

    it('returns undefined for unknown plugin', () => {
      expect(getPlugin('nonexistent')).toBeUndefined()
    })

    it('overwrites on duplicate registration', () => {
      const p1 = makePlugin({ name: 'auth', version: '1.0.0' })
      const p2 = makePlugin({ name: 'auth', version: '2.0.0' })
      registerPlugin(p1)
      registerPlugin(p2)
      expect(getPlugin('auth')?.version).toBe('2.0.0')
    })
  })

  describe('getAllPlugins', () => {
    it('returns all registered plugins', () => {
      registerPlugin(makePlugin({ name: 'a' }))
      registerPlugin(makePlugin({ name: 'b' }))
      registerPlugin(makePlugin({ name: 'c' }))
      expect(getAllPlugins()).toHaveLength(3)
    })
  })

  describe('getActivePlugins', () => {
    it('returns only plugins in the active list', () => {
      registerPlugin(makePlugin({ name: 'a' }))
      registerPlugin(makePlugin({ name: 'b' }))
      registerPlugin(makePlugin({ name: 'c' }))

      const active = getActivePlugins(['a', 'c'])
      expect(active.map(p => p.name)).toEqual(['a', 'c'])
    })

    it('skips names not in registry', () => {
      registerPlugin(makePlugin({ name: 'a' }))
      const active = getActivePlugins(['a', 'missing'])
      expect(active).toHaveLength(1)
    })

    it('preserves order from activeNames', () => {
      registerPlugin(makePlugin({ name: 'z' }))
      registerPlugin(makePlugin({ name: 'a' }))
      const active = getActivePlugins(['z', 'a'])
      expect(active.map(p => p.name)).toEqual(['z', 'a'])
    })
  })

  describe('collectMcpTools', () => {
    it('collects tools from active plugins', () => {
      registerPlugin(makePlugin({
        name: 'analytics',
        mcpTools: [
          { name: 'get_dashboard', description: 'Get dashboard', inputSchema: {}, handler: async () => ({}) },
        ],
      }))
      registerPlugin(makePlugin({
        name: 'content',
        mcpTools: [
          { name: 'publish', description: 'Publish', inputSchema: {}, handler: async () => ({}) },
        ],
      }))
      registerPlugin(makePlugin({ name: 'auth' })) // no mcpTools

      const tools = collectMcpTools(['analytics', 'content', 'auth'])
      expect(tools.map(t => t.name)).toEqual(['get_dashboard', 'publish'])
    })

    it('returns empty for plugins with no tools', () => {
      registerPlugin(makePlugin({ name: 'a' }))
      expect(collectMcpTools(['a'])).toEqual([])
    })

    it('excludes inactive plugins', () => {
      registerPlugin(makePlugin({
        name: 'secret',
        mcpTools: [{ name: 'hidden', description: '', inputSchema: {}, handler: async () => ({}) }],
      }))
      expect(collectMcpTools([])).toEqual([])
    })
  })

  describe('collectDashboardWidgets', () => {
    it('collects widgets from active plugins', () => {
      registerPlugin(makePlugin({ name: 'dashboard', dashboardWidgets: ['TaskBoard', 'WalletView'] }))
      registerPlugin(makePlugin({ name: 'notifications', dashboardWidgets: ['NotificationBell'] }))

      const widgets = collectDashboardWidgets(['dashboard', 'notifications'])
      expect(widgets).toEqual(['TaskBoard', 'WalletView', 'NotificationBell'])
    })
  })

  describe('mergePluginConfigs', () => {
    it('merges config defaults from active plugins', () => {
      registerPlugin(makePlugin({ name: 'a', configDefaults: { foo: 1 } }))
      registerPlugin(makePlugin({ name: 'b', configDefaults: { bar: 2 } }))

      const merged = mergePluginConfigs(['a', 'b'])
      expect(merged).toEqual({ foo: 1, bar: 2 })
    })

    it('later plugins override earlier ones', () => {
      registerPlugin(makePlugin({ name: 'a', configDefaults: { key: 'first' } }))
      registerPlugin(makePlugin({ name: 'b', configDefaults: { key: 'second' } }))

      const merged = mergePluginConfigs(['a', 'b'])
      expect(merged).toEqual({ key: 'second' })
    })
  })

  describe('clearPlugins', () => {
    it('empties the registry', () => {
      registerPlugin(makePlugin({ name: 'a' }))
      clearPlugins()
      expect(getAllPlugins()).toEqual([])
    })
  })
})
