---
title: "Lesson 1: Configure Your Site"
description: "Copy the example config, set your brand, and get your site running locally in under 10 minutes."
---

**Access: Free**

Before anything else — content, dashboard, contracts — you need a site that knows who it is. That's what `inkwell.config.ts` does. It's the single file that controls your brand name, colors, domain, and which features are turned on. Change it once and everything updates.

## Prerequisites

You need Node.js v20 or later and Git. That's it. Run `node --version` to check. If you're below v20, install it from [nodejs.org](https://nodejs.org).

## Step 1: Clone and Install

```bash
git clone https://github.com/Mumega-com/inkwell.git my-business
cd my-business
npm install
```

The install takes about 30 seconds. When it finishes, you have the full Inkwell codebase locally.

## Step 2: Copy the Example Config

```bash
cp inkwell.config.example.ts inkwell.config.ts
```

Open `inkwell.config.ts` in any text editor. You'll see this at the top:

```typescript
export const config = {
  name: 'Inkwell Site',
  domain: 'example.com',
  tagline: 'Publish with agents, not busywork.',
```

Replace those three values with your own. Your business name, your domain (even if it's not live yet), and a one-line pitch for your homepage.

## Step 3: Set Your Colors

Find the `theme.colors` section. Two values matter most:

```typescript
primary: '#D4A017',   // buttons, links, accents
secondary: '#06B6D4', // tags, highlights
```

Change these to your brand colors. Use any hex code. If you don't have brand colors yet, keep the defaults — gold and cyan look sharp on dark backgrounds.

## Step 4: Choose Your Features

Find `features` in the config:

```typescript
features: {
  reactions: true,
  newsletter: true,
  readingProgress: true,
  knowledgeGraph: true,
  search: true,
  // v4 features — require Cloudflare Worker
  dashboard: false,
  chat: false,
  contracts: false,
},
```

For now, keep `dashboard`, `chat`, and `contracts` set to `false`. You'll enable them in later lessons once the Worker is configured. The content features (`reactions`, `search`, `knowledgeGraph`) work without any backend.

## Step 5: Copy the Environment File

```bash
cp .env.example .env
```

Open `.env` and set:

```
SITE_URL=http://localhost:4321
```

Leave everything else blank for now. You don't need Stripe or Cloudflare credentials to run the dev server.

## Step 6: Start the Dev Server

```bash
npm run dev
```

Open `http://localhost:4321`. You should see your site with your brand name and colors. The homepage, blog listing, and navigation are all driven by your config.

## What You Have

A locally running site with your brand. Every page reflects your `name`, `tagline`, and colors. No database, no cloud services, no monthly bill — just a fast static site that you control.

## Next

[Lesson 2: Publish Your First Page →](/course/lesson-2)

Content collections, frontmatter, and dropping your first blog post.

---

**Reference:** [[config/site-config|Site Configuration Docs]] — full field reference for `inkwell.config.ts`.
