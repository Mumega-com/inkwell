---
title: "Lesson 5: Launch Your Contract Portal"
description: "Create your first contract, configure notifications, and get it signed on a customer's phone."
---

**Access: Paid**

Paper contracts slow you down. So do PDF attachments sent over email. The Inkwell contract portal gives you a shareable link your customer opens on their phone, reads, and signs in under two minutes. You get notified the moment they sign. The tracking timeline updates automatically.

## How It Works

You create a contract via the API. The API returns a unique signing URL. You send that URL to your customer — by text, email, or chat. They open it, review the terms, and sign with their finger. You receive an SMS and email confirmation. The contract moves through a 9-step tracking timeline from `created` to `signed` to `active`.

## Step 1: Set Up Your Secrets

You need Twilio for SMS and Resend for email. If you don't have accounts, create them now — both have free tiers that cover initial testing.

Add your credentials as Worker secrets (never in `wrangler.toml`):

```bash
npx wrangler secret put TWILIO_ACCOUNT_SID
npx wrangler secret put TWILIO_AUTH_TOKEN
npx wrangler secret put TWILIO_FROM_NUMBER
npx wrangler secret put RESEND_API_KEY
```

Enter each value when prompted.

## Step 2: Enable Contracts in Config

In `inkwell.config.ts`:

```typescript
features: {
  contracts: true,
},
```

Rebuild and deploy:

```bash
npm run deploy
```

## Step 3: Create Your First Contract

Send a POST request to the contracts API:

```bash
curl -X POST https://your-worker.workers.dev/api/contracts \
  -H "Content-Type: application/json" \
  -d '{
    "customer_name": "Jane Smith",
    "customer_email": "jane@example.com",
    "customer_phone": "+14165550100",
    "service": "Monthly SEO Package",
    "amount": 1500,
    "terms": "Services delivered monthly. Payment due on the 1st. 30-day cancellation notice required."
  }'
```

The response looks like this:

```json
{
  "id": "ctr_abc123",
  "signingUrl": "https://yourdomain.com/sign/ctr_abc123",
  "status": "created"
}
```

Send `signingUrl` to your customer. That's it. They open it, read the terms, and sign.

## Step 4: Customize Your Contract Terms

The `terms` field accepts plain text. Write your actual service terms here — what you deliver, when, for how much, and what happens if either party cancels.

For reusable templates, create a file at `content/en/pages/contract-template.md` and reference it from your API calls. This keeps your terms consistent across all contracts without copy-pasting.

## The 9-Step Tracking Timeline

Each contract moves through these statuses:

1. `created` — Contract generated, link ready to send
2. `sent` — Customer received the link
3. `opened` — Customer opened the signing page
4. `reviewing` — Customer has been on the page for more than 30 seconds
5. `signing` — Customer started the signature flow
6. `signed` — Signature captured
7. `notified` — SMS and email confirmations sent
8. `active` — Contract is in effect
9. `completed` or `cancelled`

Check status at any time:

```bash
curl https://your-worker.workers.dev/api/contracts/ctr_abc123
```

## What You Have

A complete digital contracting workflow. No DocuSign, no PDF tools, no monthly SaaS fee. Customers sign on their phone in under two minutes. You get notified immediately. Every status change is timestamped and stored in your D1 database.

## Next

[Lesson 6: Add Chat and Telegram →](/course/lesson-6)

Enable the chat widget and set up a Telegram bot to steer the business from your phone.

---

**Reference:** [[config/api-reference|API Reference Docs]] — full spec for `POST /api/contracts` and `GET /api/contracts/:id`.
