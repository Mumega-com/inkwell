---
title: "Lesson 3: Connect Your Data Sources"
description: "Connect Google Search Console and Analytics via MCP so real traffic data flows into your dashboard."
---

**Access: Free**

Your site generates data — search clicks, impressions, sessions, bounce rates. That data lives in Google Search Console and Google Analytics 4. This lesson connects those two sources to Inkwell so the information flows into your dashboard automatically.

## What MCP Is

MCP (Model Context Protocol) is a standard way for software to connect to external tools and data sources. Think of it as a universal adapter. When you configure an MCP connector, you're telling Inkwell: "here's where my data lives, and here's how to talk to it." You don't write API code. You add a few lines to a config file and the connection is handled.

Inkwell supports MCP connectors for Google Search Console, Google Analytics, Stripe, Twilio, and others. Each connector pulls data on a schedule and makes it available to your dashboard and AI agents.

## Step 1: Set Up Google Search Console

First, verify your site with Google. If you haven't done this:

1. Go to [search.google.com/search-console](https://search.google.com/search-console)
2. Add your property (use the URL prefix method)
3. Download the HTML verification file and put it in `public/`
4. Build and deploy your site (covered in a later lesson)
5. Click Verify

Once verified, create a service account:

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a project (name it after your business)
3. Enable the **Google Search Console API**
4. Create a service account under IAM > Service Accounts
5. Download the JSON key file — save it as `gsc-key.json` in your project root
6. Add the service account email as a user in Search Console (any permission level works)

## Step 2: Set Up Google Analytics

In the same Google Cloud project:

1. Enable the **Google Analytics Data API**
2. Copy your GA4 Measurement ID (format: `G-XXXXXXXXXX`) from GA4 Settings > Data Streams
3. Grant your service account access in GA4: Admin > Property Access Management > Add users

## Step 3: Add Credentials to Your Environment

Open `.env` and add:

```
GSC_KEY_FILE=./gsc-key.json
GSC_SITE_URL=https://yourdomain.com
GA4_PROPERTY_ID=123456789
```

The `GA4_PROPERTY_ID` is the numeric ID, not the measurement ID. Find it in GA4: Admin > Property > Property Details.

## Step 4: Configure the MCP Connectors

Open `inkwell.config.ts` and add the connectors section if it isn't there:

```typescript
connectors: {
  gsc: {
    enabled: true,
    siteUrl: 'https://yourdomain.com',
  },
  ga4: {
    enabled: true,
    propertyId: '123456789',
  },
},
```

## Step 5: Verify Data Flows

Start the Worker locally with Wrangler:

```bash
npx wrangler dev --local
```

Then test the dashboard endpoint:

```bash
curl http://localhost:8787/api/dashboard/overview
```

You should see a JSON response with traffic data. The first call may return zeros if your site is brand new — that's fine. After 24-48 hours of traffic, you'll see real numbers.

If you see an error, check:
- The service account email is added to Search Console
- The JSON key file path in `.env` is correct
- The GA4 property ID is numeric (not the `G-` measurement ID)

## What You Have

Live data from Google flowing into your Inkwell instance. Search impressions, clicks, sessions, and page-level analytics are all available to your dashboard. In Lesson 4 you'll build the views that make this data readable.

## Next

[Lesson 4: Set Up Your Dashboard →](/course/lesson-4)

Walk through the five dashboard views and set up the daily flywheel cron.

---

**Reference:** [[config/api-reference|API Reference Docs]] — all available Worker endpoints including `/api/dashboard/overview`.
