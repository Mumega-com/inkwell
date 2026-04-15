---
title: "Lesson 4: Set Up Your Dashboard"
description: "Walk through the five dashboard views, understand the KPI cards, and start the daily flywheel."
---

**Access: Paid**

The dashboard is where you run the business. Not a marketing dashboard with vanity metrics — an operational view that tells you what's actually happening: who's searching for you, who's clicked, who's become a lead, what campaigns are running, and what's coming up on the calendar.

Five views. Each one answers a specific question.

## The Five Dashboard Views

**Overview** (`/dashboard`) — The daily brief. Total sessions, leads captured, active contracts, and revenue this month. Four KPI cards at the top, a traffic chart below. Open this first every morning.

**SEO** (`/dashboard/seo`) — Your Google Search Console data. Top queries by impressions and clicks, pages by CTR, average position over time. Use this to find what's working and double down.

**Leads** (`/dashboard/leads`) — Everyone who's submitted a form or started a chat. Name, email, source, and status. From here you can create a contract for any lead directly.

**Campaigns** (`/dashboard/campaigns`) — Google Ads performance. Cost, clicks, conversions, cost-per-conversion. Lesson 7 covers setting campaigns up — this is where you read the results.

**Calendar** (`/dashboard/calendar`) — The seasonal view. Shows upcoming holidays, local events, and your own publishing schedule. Useful for planning content and campaign timing.

## Understanding the KPI Cards

Each KPI card on the overview shows a number and a trend indicator. The trend compares the current period to the previous one:

- **Green arrow up** — improving week-over-week
- **Red arrow down** — declining
- **Gray dash** — not enough data yet or flat

Don't chase the arrows blindly. A drop in sessions during a holiday week is normal. Context matters. The SEO view gives you the detail to understand why numbers move.

## Reading the Seasonal Calendar

The calendar pulls from two sources: a built-in holiday dataset and your own content schedule derived from published post dates. Use it to spot gaps — if you have nothing published for three weeks and a major holiday is coming, that's a content opportunity.

## Setting Up the Daily Flywheel

The flywheel is a Cloudflare Worker cron job that runs every morning. It pulls fresh data from GSC and GA4, stores a snapshot in your `ANALYTICS_DB`, and scores it week-over-week. If you've set up `SOS_BUS_URL`, it also posts a summary to the agent bus.

Configure the cron in `wrangler.toml`:

```toml
[[triggers.crons]]
crons = ["0 6 * * *"]
```

This runs at 6am UTC daily. Adjust the hour to match your timezone if you want it ready when you wake up.

Deploy the Worker for the cron to take effect:

```bash
npx wrangler deploy
```

Verify it ran by checking the last snapshot:

```bash
curl https://your-worker.workers.dev/api/dashboard/overview
```

The `last_updated` field in the response tells you when the cron last fired.

## Enable the Dashboard in Config

Make sure the feature is on in `inkwell.config.ts`:

```typescript
features: {
  dashboard: true,
},
```

Then rebuild and deploy:

```bash
npm run deploy
```

## What You Have

A live dashboard showing real data from your Google accounts. The daily cron runs every morning and keeps it fresh. You can now open your site and know — at a glance — whether your business is moving in the right direction.

## Next

[Lesson 5: Launch Your Contract Portal →](/course/lesson-5)

Create your first contract, set up notifications, and get it signed.

---

**Reference:** [[architecture/system-design|System Design Docs]] — how the Worker, D1, and KV interact to serve the dashboard.
