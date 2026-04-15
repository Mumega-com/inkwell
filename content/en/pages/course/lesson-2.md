---
title: "Lesson 2: Publish Your First Page"
description: "Learn how Inkwell's content collections work and publish your first blog post."
---

**Access: Free**

Inkwell organizes content into typed collections. Each collection is a folder under `content/en/`, and each collection has a schema — a set of required and optional fields validated at build time. If your frontmatter is wrong, the build tells you exactly what's missing before anything goes live. That's the Zod validation layer.

## Content Collections

Here's what ships out of the box:

| Collection | Folder | Use for |
|---|---|---|
| `blog` | `content/en/blog/` | Articles, updates, announcements |
| `pages` | `content/en/pages/` | Static pages (about, terms, etc.) |
| `products` | `content/en/products/` | Services you sell |
| `tools` | `content/en/tools/` | Tools or resources you offer |
| `labs` | `content/en/labs/` | Experiments, early ideas |
| `topics` | `content/en/topics/` | Topical landing pages |
| `team` | `content/en/team/` | Team member profiles |

Every markdown file in these folders becomes a page automatically. The URL is derived from the filename. `content/en/blog/my-first-post.md` becomes `/blog/my-first-post`.

## Frontmatter

Every file needs frontmatter — a block at the top between `---` markers. Here's the minimum for a blog post:

```markdown
---
title: "My First Post"
date: "2026-04-15"
author: "Your Name"
tags: [business, update]
description: "A short description for search results and social previews."
status: published
---

Your content starts here.
```

The `status` field matters. Set it to `published` for live content, `draft` to write without publishing, or `archived` to hide old content without deleting it.

## Write Your First Post

Create a file at `content/en/blog/hello-world.md`:

```markdown
---
title: "Hello World"
date: "2026-04-15"
author: "Your Name"
tags: [intro]
description: "We're live. Here's what we're building."
status: published
---

This is my first post. [Write a few sentences about your business and what you're building.]

## What we do

[Describe your service in plain language.]

## Why we built this

[Tell the story briefly.]
```

Save it. The dev server picks it up immediately. Refresh `http://localhost:4321/blog/hello-world` and you'll see your post.

## The Inbox Flow

For production, there's a cleaner method. Instead of writing directly to `content/en/blog/`, drop files in `content/inbox/`:

```bash
# Write your post to the inbox
# Then run:
npm run ingest
```

The ingest script validates the frontmatter, moves the file to the right collection folder, and prepares it for the next build. This is also the flow that AI agents use when publishing automatically — they drop markdown in the inbox and the pipeline handles the rest.

## Building for Production

When you're ready to see the full production build:

```bash
npm run build
```

This generates the static site in `dist/`. It also builds the Pagefind search index, generates Open Graph images, and outputs the JSON-LD structured data that helps your site show up in Google and AI search results.

## What You Have

A real blog post, live locally, with proper frontmatter, validated by schema. The foundation for everything that follows — every lesson builds on content you'll publish here.

## Next

[Lesson 3: Connect Your Data Sources →](/course/lesson-3)

Set up Google Search Console and Analytics so real data flows into your system.

---

**Reference:** [[config/schema-reference|Schema Reference Docs]] — full frontmatter field definitions for each collection.
