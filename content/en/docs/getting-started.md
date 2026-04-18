---
title: "Getting Started"
description: "Quickly set up Inkwell and start publishing your content."
order: 0
tags: ["getting-started", "docs"]
---

Welcome to Inkwell! This guide will walk you through setting up your own Inkwell instance and getting your first piece of content published.

## Why Inkwell?

Inkwell isn't just a CMS; it's a **publishing organism**. It treats your filesystem as the source of truth, the edge as your performance layer, and AI agents as your primary collaborators.

::comparison{title="Inkwell's Core Differentiators"}
| Feature | Traditional CMS | Inkwell |
|---|---|---|
| **Storage** | Database-locked | Git-native Markdown |
| **Logic** | Proprietary UI | Config-driven Code |
| **Agents** | Add-on (Chatbot) | Native (MCP Bridge) |
| **Speed** | 2-3s Latency | <100ms Edge TTFB |
::

## 1. Prerequisites

Before you begin, ensure you have the following installed:
- **Node.js:** v20+ recommended.
- **Git:** For version control.
- **Cloudflare Account:** For deployment and worker execution.
- **Docker (Optional):** For local development of workers.

::callout[info]
Inkwell is built with Astro and runs on Cloudflare. Familiarity with these technologies is helpful but not required for basic setup.
::

## 2. Clone the Repository

Start by cloning the Inkwell repository:

```bash
git clone https://github.com/Mumega-com/inkwell.git
cd inkwell
```

## 3. Install Dependencies

Install the project's Node.js dependencies:

```bash
npm install
```

## 4. Configure Your Environment

Inkwell is highly configurable via `inkwell.config.ts`. For local development and deployment, you'll need to set up environment variables.

### Local Development

Copy the example environment file and fill in your details:

```bash
cp .env.example .env
```

Open `.env` and configure at least the following:
- `SITE_URL`: Your development domain (e.g., `http://localhost:4321`).
- `STRIPE_SECRET_KEY`, `STRIPE_PRICE_*`: For payment features (optional for basic setup).
- `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `KV_NAMESPACE_ID`: For edge caching and deployment.

For detailed explanations of each variable, refer to the [[config/site-config|Site Configuration]] guide.

### Cloudflare Deployment

For deployment, you'll need to set up Cloudflare environment variables in your Pages project settings.

## 5. Run the Development Server

Start the local development server:

```bash
npm run dev
```

Visit `http://localhost:4321` (or your configured `SITE_URL`) to see Inkwell in action.

## 6. Publish Your First Post

Inkwell makes publishing seamless for both humans and agents.

### Method 1: The Inbox Flow

1.  Create a new markdown file in `content/inbox/` (e.g., `my-first-post.md`).
2.  Add frontmatter (title, description, etc.).
3.  Run the ingest script:
    ```bash
    npm run ingest
    ```
4.  The file will be moved to `content/en/blog/` and ready for build.

### Method 2: Automated Flywheel

Run `npm run flywheel` to discover trending topics and generate content briefs. You can then draft posts based on these briefs.

## Conclusion

You've now successfully set up Inkwell and published your first piece of content! Explore the [[index|documentation]] further to master its features.

::callout[feedback]
Was this guide helpful?
::
