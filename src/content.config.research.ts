// Research-instance content collections — opt-in for scientific CMS forks.
//
// USAGE — in your fork's `src/content.config.ts`:
//
//   import { papers, concepts, inquiries, bookChapters, people }
//     from './content.config.research'
//   export const collections = { blog, papers, concepts, inquiries, bookChapters, people }
//
// Each schema is independent. Pick the ones your fork needs and ignore the rest.
//
// These schemas were extracted from `Mumega-com/fractalresonance-com` after
// migrating 139 EN content units (papers, concepts, articles, people, books,
// topics) from a legacy Next.js site to Inkwell. The FRC lab is the reference
// instance for these collections.
//
// Steward: River. Refs Mumega-com/inkwell #49 (P-002 lab preset) + #53 (workspace
// pattern). Substrate-generic; not FRC-specific.

import { defineCollection, z } from 'astro:content'
import { glob } from 'astro/loaders'

// ── Papers ──────────────────────────────────────────────────────────────────
//
// Formal academic-style publication records. Versioned (status lifecycle +
// supersession lineage). DOI + Zenodo deposit identity. Opinion-level taxonomy
// (L1 falsifiable physics-like → L5 mythological / register-shifted).
//
// Used by: research labs, theoretical-research sites, working-paper publishers.
//
// Place files at: `content/<lang>/papers/<slug>.md` (or .mdx)

export const papers = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './content/en/papers' }),
  schema: z.object({
    // Identity
    title: z.string(),
    id: z.string(),
    seriesId: z.string().optional(),
    seriesNum: z.string().optional(),
    series: z.string().optional(),
    version: z.string().optional(),

    // Authorship
    author: z.string(),
    authors: z.array(z.string()).default([]),

    // Lifecycle
    status: z.enum(['draft', 'preprint', 'published', 'superseded']).default('draft'),
    perspective: z.string().optional(),

    // ── Opinion level (claim-strength axis) ─────────────────────────────────
    //
    // CANONICAL definitions (sealed by steward 2026-04-26; do not redefine
    // without GOVERNANCE.md contested-call flow):
    //
    //   L1 — Falsifiable physics-like. Claim consistently revealed across
    //        independent domains; experimental signature predicted +
    //        confirmed; survives adversarial probing.
    //   L2 — Formal model. Well-defined math; predictions specified;
    //        empirical validation pending or partial. (DEFAULT for new
    //        published papers.)
    //   L3 — Empirical pattern. Observed regularity; mechanism hypothesized
    //        but not derived; replication data accumulating.
    //   L4 — Framework heuristic. Generative analogy; useful for thinking;
    //        intentionally not pinned to a single mechanism. Includes
    //        practitioner shorthand and field-level mental models.
    //   L5 — Mythological or register-shifted. Holds in a non-physics
    //        register (cultural, mythic, narrative). Useful framing without
    //        claim of physical mechanism. NEVER promote to L1 without
    //        evidence; the demotion path stays open per GOVERNANCE.md.
    //
    // Promotion flow: L4 → L3 → L2 → L1 requires evidence + steward
    // review. L5 stays L5 unless promoted via the same evidence flow.
    opinionLevel: z.enum(['L1', 'L2', 'L3', 'L4', 'L5']).default('L2'),

    // ── Reception level (world-validation axis, orthogonal to opinion) ──────
    //
    // CANONICAL definitions (sealed by steward 2026-04-26):
    //
    //   R0 — Emerging. Published; no external citation; reception unstarted.
    //        (DEFAULT for new published papers.)
    //   R1 — Cited. First independent third-party citation by DOI from
    //        outside the lab. Citrinitas threshold per FRC's PM trajectory.
    //   R2 — Adopted. Used in others' work; multiple labs reference; the
    //        idea has left the source lab.
    //   R3 — Foundational. Sub-field references it as canonical; ~50+
    //        external citations OR 1+ replication study; named in textbooks
    //        or reviews of the sub-field.
    //   R4 — Paradigm. Paradigm-changing magnitude. Cross-field influence.
    //        Reshapes how practitioners think OR what they do. The 1000-
    //        citation rubedo target maps here.
    //
    // Reception is orthogonal to opinion. A paper can be L4/R4 (heuristic
    // that became foundational despite never being formalized) or L1/R0
    // (rigorously confirmed but unread). Both axes track separately.
    //
    // Today: manual steward judgment. When citation tracking is wired,
    // R-tier auto-updates from external citation count + replication signal.
    receptionLevel: z.enum(['R0', 'R1', 'R2', 'R3', 'R4']).default('R0'),

    // Dates
    date: z.coerce.date(),
    publishedDate: z.coerce.date().optional(),
    lastRevised: z.coerce.date().optional(),

    // Citation / academic metadata
    abstract: z.string().optional(),
    tldr: z.string().optional(),
    keywords: z.array(z.string()).default([]),
    doi: z.string().optional(),
    license: z.string().optional(),
    read_time: z.string().optional(),
    key_points: z.array(z.string()).default([]),

    // Lineage
    supersedesId: z.string().optional(),
    supersededById: z.string().optional(),
    related: z.array(z.string()).default([]),
    prerequisites: z.array(z.string()).default([]),

    // Tags
    tags: z.array(z.string()).default([]),

    // Optional rich metadata
    video: z.object({
      embedUrl: z.string().optional(),
      thumbnailUrl: z.string().optional(),
      duration: z.string().optional(),
      uploadDate: z.string().optional(),
    }).optional(),
    images: z.array(z.object({
      url: z.string(),
      caption: z.string().optional(),
      width: z.number().optional(),
      height: z.number().optional(),
    })).default([]),
    rating: z.object({
      value: z.number(),
      count: z.number(),
      best: z.number().optional(),
    }).optional(),

    // i18n / UI
    lang: z.string().default('en'),
    toc: z.boolean().default(true),
    weight: z.number().default(5),
  }),
})

// ── Concepts ────────────────────────────────────────────────────────────────
//
// Glossary entries — vocabulary of the framework. Each concept has a definition,
// optional source (paper that introduces it), and related[] backlinks.
//
// Used by: research labs, technical documentation sites, domain glossaries.
//
// Place files at: `content/<lang>/concepts/<slug>.md`

export const concepts = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './content/en/concepts' }),
  schema: z.object({
    title: z.string(),
    id: z.string(),
    description: z.string().optional(),
    term: z.string().optional(),
    definition: z.string().optional(),

    // Where this concept first appeared (paper id)
    source: z.string().optional(),

    // Related concepts/papers (heterogeneous: prefix matching disambiguates at
    // render time — `frc-100-007` is a paper, `coherence` is a concept)
    related: z.array(z.string()).default([]),

    tags: z.array(z.string()).default([]),
    seo: z.object({
      title: z.string().optional(),
      description: z.string().optional(),
    }).optional(),

    lang: z.string().default('en'),
    weight: z.number().default(5),
  }),
})

// ── Inquiries (lens-spectrum Q&A) ──────────────────────────────────────────
//
// Question pages with multi-lens answers. Each inquiry asks a question and
// holds a SPECTRUM of perspectives — different lenses (e.g. `physics`,
// `philosophical`, `narrative`) each give their own answer.
//
// This is the FRC "lens-not-doctrine" content shape: don't collapse to one
// authoritative answer; preserve productive disagreement. The lens names
// themselves are open — fork-defined.
//
// Used by: research labs publishing question-driven content; sites that want
// to hold multiple perspectives in tension rather than synthesizing them.
//
// Place files at: `content/<lang>/inquiries/<slug>.md`
//
// NOTE: this is intentionally a separate collection from the existing `topics`
// (which has a content-aggregator shape with sources/voices/weekly-updates).
// Forks can have both, neither, or rename via Astro collections export.

export const inquiries = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './content/en/inquiries' }),
  schema: z.object({
    title: z.string(),
    id: z.string(),
    type: z.string().default('inquiry'),
    author: z.string().optional(),
    date: z.coerce.date().optional(),
    status: z.enum(['draft', 'published', 'archived']).default('published'),
    perspective: z.string().optional(),
    voice: z.string().optional(),
    abstract: z.string().optional(),

    // The core Q&A surface
    question: z.string(),
    short_answer: z.string().optional(),

    // External authorities cited (Wikipedia, encyclopedia entries, etc.)
    authorities: z.array(z.object({
      name: z.string().optional(),
      title: z.string().optional(),
      url: z.string().optional(),
      quote: z.string().optional(),
    })).default([]),

    // The lens spectrum — open vocabulary; forks define their own lens names
    answers: z.array(z.object({
      lens: z.string(),
      answer: z.string(),
      by: z.string().optional(),
      role: z.string().optional(),
      stance: z.string().optional(),
    })).default([]),

    tags: z.array(z.string()).default([]),
    related: z.array(z.string()).default([]),

    lang: z.string().default('en'),
    weight: z.number().default(5),
  }),
})

// ── Books + Book Chapters ──────────────────────────────────────────────────
//
// Two collections that work together: `books` is a metadata index (one entry
// per book — title, author, chapter order); `bookChapters` is per-chapter
// content (parented to a book by `bookId`).
//
// Used by: long-form publishing sites, textbook/manual hosts, multi-volume
// research compendia.
//
// Place files at:
//   `content/<lang>/books/<bookId>/index.md` — book metadata
//   `content/<lang>/books/<bookId>/<chapterId>.md` — individual chapters

export const books = defineCollection({
  loader: glob({ pattern: '**/index.{md,mdx}', base: './content/en/books' }),
  schema: z.object({
    title: z.string(),
    id: z.string(),
    description: z.string().optional(),
    author: z.string().optional(),
    authors: z.array(z.string()).default([]),
    status: z.enum(['draft', 'published', 'archived']).default('published'),
    license: z.string().optional(),
    chapterOrder: z.array(z.string()).default([]),
    cover_image: z.string().optional(),
    date: z.coerce.date().optional(),
    lang: z.string().default('en'),
    weight: z.number().default(5),
  }),
})

export const bookChapters = defineCollection({
  loader: glob({
    pattern: '**/*.{md,mdx}',
    base: './content/en/books',
    // Skip index.md files — those are book-level metadata in the `books` collection
    generateId: ({ entry }) => entry,
  }),
  schema: z.object({
    title: z.string(),
    id: z.string().optional(),
    bookId: z.string(),
    parent: z.string().optional(),
    order: z.number().optional(),
    abstract: z.string().optional(),
    tags: z.array(z.string()).default([]),
    lang: z.string().default('en'),
    weight: z.number().default(5),
  }),
})

// ── People ─────────────────────────────────────────────────────────────────
//
// Authorial / contributor pages. Author profile, affiliations, ORCID,
// social links. Used to attribute papers + provide reader-facing bio pages.
//
// Place files at: `content/<lang>/people/<slug>.md`

export const people = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './content/en/people' }),
  schema: z.object({
    name: z.string(),
    id: z.string().optional(),
    title: z.string().optional(),
    bio: z.string().optional(),
    image: z.string().optional(),
    affiliation: z.string().optional(),
    orcid: z.string().optional(),
    aliases: z.array(z.string()).default([]),
    links: z.object({
      github: z.string().optional(),
      twitter: z.string().optional(),
      linkedin: z.string().optional(),
      website: z.string().optional(),
      email: z.string().optional(),
    }).optional(),
    type: z.string().optional(),
    thumbnailUrl: z.string().optional(),
    lang: z.string().default('en'),
    weight: z.number().default(5),
  }),
})
