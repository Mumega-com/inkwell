---
title: "Lesson 6: Add Chat and Telegram"
description: "Enable the chat widget and set up a Telegram bot so customers can reach you and you can steer the business from your phone."
---

**Access: Paid**

Two channels, one lesson. The chat widget goes on your site so customers can reach you. The Telegram bot goes on your phone so you can steer the business without opening a browser. They're connected: a chat from your site can route to your Telegram, and you can pull reports and check leads right from the Telegram app.

## Part 1: The Chat Widget

### Enable in Config

```typescript
features: {
  chat: true,
},
```

Rebuild and deploy. The chat widget appears in the bottom-right corner of every page.

### How It Works

When a visitor sends a message, it's stored in your `DB` (D1) as a lead and optionally forwarded to Telegram if the bot is configured. The widget is a React island that loads with `client:load` — it's fast and doesn't block page rendering.

You don't need a third-party chat service. No Intercom, no Drift, no monthly bill. It's built into the Worker.

## Part 2: The Telegram Bot

### Step 1: Create a Bot

Open Telegram and search for `@BotFather`. Start a conversation and send:

```
/newbot
```

BotFather will ask for a name and a username. The username must end in `bot` (e.g., `yourbusiness_bot`). When you're done, BotFather gives you an API token that looks like:

```
7123456789:AAHdqTcvCH1vGWJxfSeofSs0K5PALDsaw2c
```

Save that token.

### Step 2: Add the Token as a Secret

```bash
npx wrangler secret put TELEGRAM_BOT_TOKEN
```

Paste the token when prompted.

### Step 3: Configure the Webhook

Once your Worker is deployed, register the webhook so Telegram knows where to send messages:

```bash
curl "https://api.telegram.org/bot<YOUR_TOKEN>/setWebhook?url=https://your-worker.workers.dev/api/telegram"
```

Replace `<YOUR_TOKEN>` with your bot token and update the Worker URL. You should get:

```json
{"ok": true, "result": true, "description": "Webhook was set"}
```

### Step 4: Add Your Chat ID

Find your Telegram chat ID by sending any message to your bot, then:

```bash
curl "https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates"
```

Look for `"chat":{"id":123456789}` in the response. Add that to your Worker secrets:

```bash
npx wrangler secret put TELEGRAM_OWNER_CHAT_ID
```

## Available Bot Commands

Once the webhook is live, open your bot in Telegram and try:

| Command | What it does |
|---|---|
| `/status` | Shows today's session count and lead count |
| `/leads` | Lists the 5 most recent leads |
| `/help` | Shows all available commands |

These commands query your Worker's API directly. The responses come back in seconds.

## Redeploy

```bash
npm run deploy
```

After deployment, test the bot: send `/status` and confirm you get a response.

## What You Have

Customers can chat on your site. You steer the business from Telegram — check leads, pull daily stats, and receive chat notifications without logging into anything. If a customer sends a message at 11pm, you see it when you wake up and can respond from your phone.

## Next

[Lesson 7: Run Your First Campaign →](/course/lesson-7)

The ARROW framework, Google Ads setup, and your first $10/day campaign.

---

**Reference:** [[features/interactive-components|Interactive Components Docs]] — how the chat widget is built and how to customize it.
