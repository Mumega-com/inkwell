// Generic vertical pack — upstream-core 7 collections re-exported as a pack.
//
// This pack is the **canonical "no vertical chosen yet" option** for forks
// that don't yet need vertical-specific schemas. Picking "generic" in the
// signup-flow vertical picker (re/dental/grants/research/generic) lands you
// here.
//
// USAGE — in your fork's `src/content.config.ts`:
//
//   import { blog, topics, labs, tools, team, products, pages }
//     from './content.config.generic'
//   export const collections = { blog, topics, labs, tools, team, products, pages }
//
// Or — equivalently — just keep the upstream-core `collections` export and
// don't import this pack at all. This file exists so the auto-deploy /
// signup-flow has a uniform path: every vertical option in the picker maps
// to a real `content.config.<vertical>.ts` file. No special-cases.
//
// LOCK-J in S012 brief: filesystem IS the pack registry. Generic is a
// substrate-real artifact, not a fallback for "we ran out of presets."
//
// Steward: River. Refs Mumega-com/inkwell #54 (brand extraction), #56
// (research vertical pack), #57 (real-estate vertical pack — first commercial),
// LOCK-I (generic pack as canonical option), LOCK-J (no special-case branches),
// LOCK-K (substrate-purity through auto-deploy).

export { blog, topics, labs, tools, team, products, pages } from './content.config'
