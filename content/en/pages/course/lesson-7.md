---
title: "Lesson 7: Run Your First Campaign"
description: "The ARROW framework, Google Ads setup, conversion tracking, and a first campaign at $10/day."
---

**Access: Paid**

Most small businesses waste money on ads because they don't have a system. They pick a budget, write some copy, and wait. When it doesn't work, they stop. This lesson gives you a system — the ARROW framework — and a measurable campaign you can run for two weeks and actually learn from.

## The ARROW Framework

ARROW is how you think about growth in Inkwell. Each letter is a stage:

- **A — Acquire.** Get attention. Paid search, organic, referrals.
- **R — Resonate.** Turn attention into interest. Your landing page, your offer, your proof.
- **R — Route.** Move interest toward action. Clear CTAs, fast load times, no dead ends.
- **O — Operate.** Handle the inquiry. Chat, contracts, follow-up.
- **W — Widen.** Repeat what worked. Scale the channels that convert, cut the ones that don't.

This lesson covers A through R. The rest of ARROW is already in place from the previous lessons.

## Step 1: Connect Google Ads via MCP

In `inkwell.config.ts`:

```typescript
connectors: {
  googleAds: {
    enabled: true,
    customerId: '123-456-7890',
  },
},
```

You'll also need to add your Google Ads credentials to `.env`:

```
GOOGLE_ADS_DEVELOPER_TOKEN=your_token_here
GOOGLE_ADS_CLIENT_ID=your_client_id
GOOGLE_ADS_CLIENT_SECRET=your_client_secret
GOOGLE_ADS_REFRESH_TOKEN=your_refresh_token
```

Generate the OAuth credentials from [developers.google.com/google-ads/api](https://developers.google.com/google-ads/api). The developer token comes from your Google Ads account under Tools > API Center.

## Step 2: Create a Landing Page

Every campaign needs a dedicated landing page — not your homepage. Create one at `content/en/pages/campaign-spring.md`:

```markdown
---
title: "Spring Special — [Your Service]"
description: "Book before May 1st and get your first month free."
status: published
noindex: true
---

## [Your Headline]

One sentence about what you do and who it's for.

## What You Get

- [Benefit 1]
- [Benefit 2]
- [Benefit 3]

## How It Works

1. [Step 1]
2. [Step 2]
3. [Step 3]

[CTA Button — links to your contract signing flow]
```

Keep it short. One offer, one CTA, no navigation links to distract. Set `noindex: true` so Google doesn't confuse it with your main content.

## Step 3: Create the Campaign in Google Ads

Log into Google Ads. Create a new campaign:

- **Goal:** Leads
- **Type:** Search
- **Budget:** $10/day
- **Bidding:** Maximize conversions (switch to Target CPA after 30+ conversions)
- **Keywords:** 5–10 exact and phrase match terms your customers actually search for
- **Ad copy:** Headline matches what they searched. Description explains your offer.
- **Final URL:** Your landing page URL

Start narrow. It's easier to expand a working campaign than to cut a broken one.

## Step 4: Set Up Conversion Tracking

In Google Ads, create a conversion action:

1. Tools > Conversions > New conversion action
2. Choose "Website"
3. Action: "Submit lead form" or "Sign contract"
4. Copy the Global Site Tag snippet

Add the tag to your Inkwell config:

```typescript
analytics: {
  googleAds: 'AW-XXXXXXXXXX/YYYYYYY',
},
```

Inkwell injects it automatically into the page `<head>`. The conversion fires when a visitor submits the lead form or reaches the contract signing confirmation page.

## Step 5: Run for Two Weeks

Launch the campaign and don't touch it for 14 days. Seriously. Google's algorithm needs time to learn. Changing bids or copy in the first week resets the learning phase and wastes money.

After two weeks, check:

- **Impressions:** Are people searching for these terms?
- **CTR:** Are they clicking your ads?
- **Conversions:** Are clicks turning into leads?
- **Cost per lead:** Is it worth it?

## What You Have

A structured campaign with a dedicated landing page, conversion tracking, and two weeks of data incoming. The ARROW framework gives you the mental model to know what to optimize and when.

## Next

[Lesson 8: Read Your Data and Grow →](/course/lesson-8)

The weekly review system and how to steer your business from the dashboard.

---

**Reference:** [[features/seo-discovery|SEO & Discovery Docs]] — how Inkwell structures landing pages for maximum search relevance.
