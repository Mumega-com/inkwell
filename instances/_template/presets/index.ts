/**
 * Site-type presets — used by `sos init --preset <name>` to configure
 * the plugin set, theme, and features for a new Inkwell instance.
 *
 * Each preset exports a partial config that gets merged over the base
 * inkwell.config.ts during instance creation.
 */
export { preset as agency } from './agency'
export { preset as company } from './company'
export { preset as creator } from './creator'
export { preset as saas } from './saas'
