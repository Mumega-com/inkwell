# Inkwell Content Strategy

## Voice
Inkwell speaks as a builder, not a marketer. Technical but accessible. Opinionated but evidence-based. Every claim should be backed by something the site can actually show: a post, a page, a feature, or a working integration.

## Content Pillars

### 1. Vision
What the CMS is, who it is for, and where it is going.
- Why the framework exists
- What problems it solves
- What a fork should change first
- How the roadmap evolves

### 2. Publishing
How content moves from draft to live page.
- Markdown and MDX workflows
- Inbox-based publishing
- API-backed publishing
- Review and deploy steps

### 3. Technology
What we build and how.
- Astro, Cloudflare, and static output
- Search, RSS, sitemap, and JSON-LD
- Optional Worker integrations
- Build journals and release notes

### 4. People
Who maintains the system.
- Maintainer profiles
- Contributor spotlights
- Onboarding stories
- What each role owns

### 5. Examples
Demonstrations of the CMS in action.
- Case studies
- Sample topic pages
- Sample product pages
- Integration writeups

## Content Calendar

### Weekly Rhythm
- **Monday:** Build journal — what changed and why
- **Wednesday:** Deep dive — one feature or workflow
- **Friday:** Reaction post — how current events relate to the CMS

### Monthly
- Maintainer spotlight — profile one contributor or role
- Release recap — shipped features, fixes, and lessons
- Platform review — what the system learned from the month

## Publishing Flow

### Agent publishes:
```
1. Agent writes markdown following templates/post.md
2. Drops in content/inbox/
3. Run: npm run ingest
4. Review: check content/en/blog/{slug}.md
5. Deploy: npm run build && npm run deploy
```

### From the bus:
```
mcp__sos__send(to="inkwell-web", text="publish: [markdown content]")
→ Agent processes → drops in inbox → ingest → deploy
```

## Content Quality Rules

1. Every post must have a description for search and social cards
2. Every post must have 2+ tags for discoverability
3. Minimum 300 words unless the format is intentionally short
4. Must include at least one of: data, example, story, or opinion
5. Write from the perspective of the project, not generic AI filler
6. Link to related posts using [[wikilinks]] or relative URLs

## Flywheel Topics (monitor these)

### Hacker News
- AI-assisted publishing
- CMS alternatives, static site generators
- Cloudflare Workers, edge computing
- Markdown tooling and editor workflows
- Distributed collaboration tools

### Reddit
- r/webdev, r/nextjs, r/cloudflare
- r/Wordpress, r/ghost, r/cms
- r/artificial, r/MachineLearning

### Industry
- Astro releases
- Cloudflare platform updates
- OpenAI and Anthropic product changes
- CMS, blogging, and publishing news

## Reaction Post Template

When a trending topic aligns with our pillars:

```markdown
---
title: "[Topic] — Here's What We Think"
date: "YYYY-MM-DD"
author: "inkwell-web"
tags: ["relevant-tag", "another"]
description: "Our take on [topic], from experience running a forkable CMS."
---

[1 paragraph: what happened — the news]

## Why This Matters

[2 paragraphs: connect to Inkwell's perspective]

## What We've Learned

[2 paragraphs: cite our actual experience/data]

## What's Next

[1 paragraph: what this means for the future]
```

## Success Metrics

- **Publish rate:** 3 posts/week minimum
- **Organic traffic:** growing week over week
- **Read-through:** >60% average where content is long-form
- **Knowledge graph density:** edges per node increasing
- **Newsletter subscribers:** growing
- **Reaction engagement:** >5% of readers react
