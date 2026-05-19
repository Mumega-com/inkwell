import type { BusPort, BusMessage } from '../types'

/**
 * Standalone bus adapter — no-op for Inkwell running without SOS.
 * Messages are stored in-memory for the current request lifecycle only.
 */
export class StandaloneBusAdapter implements BusPort {
  private messages: BusMessage[] = []

  async send(_to: string, _text: string): Promise<void> {
    // No-op: standalone mode has no bus
  }

  async broadcast(_text: string): Promise<void> {
    // No-op: standalone mode has no bus
  }

  async subscribe(_callback: (msg: BusMessage) => Promise<void>): Promise<{ unsubscribe: () => Promise<void> }> {
    return { unsubscribe: async () => {} }
  }

  async inbox(_limit?: number): Promise<BusMessage[]> {
    return this.messages
  }
}
