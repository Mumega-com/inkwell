/**
 * CF Workflows entrypoint exports.
 *
 * Separate from index.ts so the cloudflare:workflows import doesn't
 * break the vitest test runner (which doesn't have the module available).
 *
 * Wrangler picks up these exports via the [[workflows]] config in wrangler.toml.
 * The main worker entrypoint (index.ts) is unaffected.
 */
export { GenericWorkflow } from './workflows/generic'
export { OutreachSequenceWorkflow } from './workflows/outreach-sequence'
