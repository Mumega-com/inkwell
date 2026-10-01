import type { MemoryPort, MemoryResult } from '../types'
import { SOSMemoryAdapter } from './sos-memory'

/**
 * A configured Mirror projection that cannot reach Mirror.
 * This stays failed. It does not substitute the in-process map.
 */
export class UnavailableMirrorMemoryAdapter implements MemoryPort {
  async remember(): Promise<string> {
    throw Object.assign(new Error('mirror_unconfigured'), { projectionStatus: 'failed' })
  }

  async recall(): Promise<MemoryResult[]> {
    throw Object.assign(new Error('mirror_unconfigured'), { projectionStatus: 'failed' })
  }

  async search(): Promise<MemoryResult[]> {
    throw Object.assign(new Error('mirror_unconfigured'), { projectionStatus: 'failed' })
  }
}

export function selectMirrorMemoryAdapter(
  env: { SOS_MIRROR_URL?: string; NETWORK_TOKEN?: string },
  tenant: string,
): MemoryPort {
  if (!env.SOS_MIRROR_URL || !env.NETWORK_TOKEN) return new UnavailableMirrorMemoryAdapter()
  return new SOSMemoryAdapter(env.SOS_MIRROR_URL, env.NETWORK_TOKEN, tenant)
}
