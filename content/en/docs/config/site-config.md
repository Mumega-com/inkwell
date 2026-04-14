---
title: "Site Configuration"
description: "A complete reference for inkwell.config.ts — the brain of your CMS."
parent: "index"
order: 5
tags: ["config", "docs"]
---

The `inkwell.config.ts` file controls every aspect of your site's identity, theme, and features.

## 1. Site Identity

::comparison{title="Identity Fields"}
| Property | Type | Description |
|---|---|---|
| `name` | `string` | Your brand name. Used in headers, titles, and SEO. |
| `domain` | `string` | The canonical domain (e.g., `mumega.com`). |
| `tagline` | `string` | A short pitch for your homepage hero. |
::

## 2. Theme Configuration

Inkwell uses a **Light/Dark** hybrid system generated at build-time into CSS custom properties.

::mermaid
graph LR
  C[Config] --> T[theme.ts]
  T --> V[CSS Variables]
  V --> A[Astro Layouts]
  V --> R[React Islands]
::

### Color Palette

::comparison{title="Core Colors"}
| Color | Default | Purpose |
|---|---|---|
| `primary` | `#D4A017` | Buttons, links, and accents. |
| `secondary` | `#06B6D4` | Tool tags and secondary highlights. |
| `bg` | Dark/Light | Root background color. |
| `surface` | Dark/Light | Card and panel backgrounds. |
::

## 3. Feature Flags

Toggle site capabilities with simple booleans.

::metric{label="Features Active" value="10/10" trend="up"}

::comparison{title="Feature Flags"}
| Flag | Description |
|---|---|
| `reactions` | Enable the emoji reaction island on posts. |
| `newsletter` | Show the email subscription CTA. |
| `readingProgress` | Display the progress bar during scroll. |
| `knowledgeGraph` | Enable the `/explore` interactive graph. |
| `search` | Build and serve the Pagefind search index. |
::

## 4. SEO & Social

Document your site for AI and human search engines.

::callout[info]
The `knowsAbout` field is a high-leverage property for AI search visibility (ChatGPT/Gemini). It tells models what topics your site is an authority on.
::

## 5. Worker & Publishing

- `workerUrl`: The base URL of your Cloudflare Worker (`inkwell-api`).
- `publish`: Toggles for `inbox`, `api`, and `mcp` publishing methods.

---

[[architecture/system-design|Learn more about how the config is processed]] or [[features/interactive-components|Explore interactive blocks]].
