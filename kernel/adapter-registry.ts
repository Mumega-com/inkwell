import type { DatabasePort, AuthPort, CRMPort, SearchPort } from './types'

/** All available port types. */
export interface PortMap {
  database: DatabasePort
  auth: AuthPort
  crm: CRMPort
  search: SearchPort
}

type PortName = keyof PortMap

const adapters: Partial<Record<PortName, unknown>> = {}

/** Register an adapter for a port. Call at Worker startup. */
export function setAdapter<K extends PortName>(port: K, adapter: PortMap[K]): void {
  adapters[port] = adapter
}

/** Get the registered adapter for a port. Throws if not registered. */
export function getAdapter<K extends PortName>(port: K): PortMap[K] {
  const adapter = adapters[port]
  if (!adapter) {
    throw new Error(
      `No adapter registered for port "${port}". ` +
      `Register one at startup: setAdapter("${port}", myAdapter)`
    )
  }
  return adapter as PortMap[K]
}

/** Check if an adapter is registered for a port. */
export function hasAdapter(port: PortName): boolean {
  return adapters[port] !== undefined
}

/** Get adapter if registered, undefined otherwise. No throw. */
export function tryGetAdapter<K extends PortName>(port: K): PortMap[K] | undefined {
  return adapters[port] as PortMap[K] | undefined
}

/** Clear all adapters (useful for testing). */
export function clearAdapters(): void {
  for (const key of Object.keys(adapters)) {
    delete adapters[key as PortName]
  }
}
