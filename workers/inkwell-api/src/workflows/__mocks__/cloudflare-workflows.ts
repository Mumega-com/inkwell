/**
 * Mock for cloudflare:workflows module during vitest.
 * The real module is only available in the Cloudflare Workers runtime.
 */
export class WorkflowEntrypoint<E = unknown, P = unknown> {
  protected env: E
  constructor(ctx: unknown, env: E) {
    this.env = env
  }
}

export interface WorkflowStep {
  do<T>(name: string, callback: () => Promise<T>): Promise<T>
  do<T>(name: string, config: unknown, callback: () => Promise<T>): Promise<T>
  sleep(name: string, duration: string): Promise<void>
  sleepUntil(name: string, date: Date): Promise<void>
}

export interface WorkflowEvent<P = unknown> {
  payload: P
  timestamp: Date
}
