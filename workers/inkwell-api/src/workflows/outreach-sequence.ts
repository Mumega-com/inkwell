import { WorkflowEntrypoint, WorkflowStep, WorkflowEvent } from 'cloudflare:workflows'

interface Env {
  DB_CORE: D1Database
  DB_ANALYTICS: D1Database
  [key: string]: unknown
}

interface D1Database {
  prepare(sql: string): D1PreparedStatement
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement
  run(): Promise<unknown>
  all<T = unknown>(): Promise<{ results: T[] }>
  first<T = unknown>(): Promise<T | null>
}

interface OutreachParams {
  sequence_id: string
  contacts: Array<{ id: string; email: string; first_name?: string; company?: string }>
  template: string
  channel: 'email' | 'sms'
  delay_between_sends: string
  webhook_url?: string
}

export class OutreachSequenceWorkflow extends WorkflowEntrypoint<Env, OutreachParams> {
  async run(event: WorkflowEvent<OutreachParams>, step: WorkflowStep) {
    const { contacts, template, channel, delay_between_sends, sequence_id, webhook_url } = event.payload

    // Step 1: Mark sequence as running
    await step.do('mark-running', async () => {
      await this.env.DB_CORE.prepare(
        'UPDATE outreach_sequences SET status = ? WHERE id = ?'
      ).bind('running', sequence_id).run()
    })

    // Step 2: Send to each contact with delay between sends
    for (let i = 0; i < contacts.length; i++) {
      const contact = contacts[i]
      const stepName = `send-${contact.id}`

      await step.do(stepName, {
        retries: { limit: 3, delay: '30 seconds', backoff: 'exponential' },
      }, async () => {
        // Replace template placeholders
        const message = template
          .replace(/\{\{first_name\}\}/g, contact.first_name ?? 'there')
          .replace(/\{\{company\}\}/g, contact.company ?? '')
          .replace(/\{\{email\}\}/g, contact.email)

        if (channel === 'email') {
          // Use CF Email Worker or webhook
          const emailWebhook = (this.env as Record<string, string>)['EMAIL_WEBHOOK_URL'] // as cast: env keys are typed as unknown
          if (emailWebhook) {
            await fetch(emailWebhook, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ to: contact.email, body: message, sequence_id }),
            })
          }
        }

        // Mark step as sent
        await this.env.DB_CORE.prepare(
          "UPDATE outreach_steps SET status = ?, sent_at = datetime('now') WHERE sequence_id = ? AND contact_id = ?"
        ).bind('sent', sequence_id, contact.id).run()

        return { sent: true, contact_id: contact.id }
      })

      // Delay between sends (unless last contact)
      if (i < contacts.length - 1) {
        await step.sleep(`delay-after-${contact.id}`, delay_between_sends)
      }
    }

    // Step 3: Mark sequence complete
    await step.do('mark-complete', async () => {
      await this.env.DB_CORE.prepare(
        "UPDATE outreach_sequences SET status = ?, sent_count = ?, updated_at = datetime('now') WHERE id = ?"
      ).bind('completed', contacts.length, sequence_id).run()
    })

    // Step 4: Callback webhook if provided
    if (webhook_url) {
      await step.do('callback', async () => {
        await fetch(webhook_url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sequence_id, status: 'completed', sent_count: contacts.length }),
        })
      })
    }
  }
}
