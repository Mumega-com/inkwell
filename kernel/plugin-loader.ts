import type { PluginManifest, McpToolDef, HonoApp } from './types'

const registry = new Map<string, PluginManifest>()

/** Register a plugin manifest. Call at Worker startup. */
export function registerPlugin(manifest: PluginManifest): void {
  if (registry.has(manifest.name)) {
    console.warn(`Plugin "${manifest.name}" already registered, overwriting`)
  }
  registry.set(manifest.name, manifest)
}

/** Get a single plugin by name. */
export function getPlugin(name: string): PluginManifest | undefined {
  return registry.get(name)
}

/** Get all registered plugins. */
export function getAllPlugins(): PluginManifest[] {
  return Array.from(registry.values())
}

/** Get only the plugins listed in activeNames. */
export function getActivePlugins(activeNames: string[]): PluginManifest[] {
  return activeNames
    .map(name => registry.get(name))
    .filter((p): p is PluginManifest => p !== undefined)
}

/** Mount routes for active plugins onto the Hono app. */
export function mountPluginRoutes(app: HonoApp, activeNames: string[]): void {
  for (const plugin of getActivePlugins(activeNames)) {
    if (plugin.mountRoutes) {
      plugin.mountRoutes(app as any)
    }
  }
}

/** Collect all MCP tool definitions from active plugins. */
export function collectMcpTools(activeNames: string[]): McpToolDef[] {
  const tools: McpToolDef[] = []
  for (const plugin of getActivePlugins(activeNames)) {
    if (plugin.mcpTools) {
      tools.push(...plugin.mcpTools)
    }
  }
  return tools
}

/** Collect all dashboard widget names from active plugins. */
export function collectDashboardWidgets(activeNames: string[]): string[] {
  const widgets: string[] = []
  for (const plugin of getActivePlugins(activeNames)) {
    if (plugin.dashboardWidgets) {
      widgets.push(...plugin.dashboardWidgets)
    }
  }
  return widgets
}

/** Get merged config defaults from all active plugins. */
export function mergePluginConfigs(activeNames: string[]): Record<string, unknown> {
  const merged: Record<string, unknown> = {}
  for (const plugin of getActivePlugins(activeNames)) {
    if (plugin.configDefaults) {
      Object.assign(merged, plugin.configDefaults)
    }
  }
  return merged
}

/** Clear all registered plugins (useful for testing). */
export function clearPlugins(): void {
  registry.clear()
}
