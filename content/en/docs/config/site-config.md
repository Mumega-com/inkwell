---
title: "Theming & Configuration"
description: "A complete reference for inkwell.config.ts and the Inkwell Design System."
parent: "index"
order: 5
tags: ["config", "docs", "theming"]
---

The `inkwell.config.ts` file is the **brain** of your CMS. It controls your site's identity, design system, and feature set.

## 1. Design System (CSS Variables)

Inkwell uses a **Light/Dark** hybrid system. Your configuration is transformed at build-time into CSS custom properties (variables) available to both Astro and React components.

::mermaid
graph LR
  C[inkwell.config.ts] --> T[lib/theme.ts]
  T --> V[:root CSS Variables]
  V --> A[Astro Layouts]
  V --> R[React Islands]
::

### Core Variable Map

| Variable | Config Source | Default |
|---|---|---|
| `--ink-primary` | `theme.colors.primary` | `#D4A017` |
| `--ink-secondary` | `theme.colors.secondary` | `#06B6D4` |
| `--ink-bg` | Auto-generated | `#0A0A0A` (Dark) |
| `--ink-surface` | Auto-generated | `#141414` (Dark) |
| `--ink-radius` | `theme.borderRadius` | `8px` |

## 2. Typography

Inkwell is optimized for **JetBrains Mono** and high-readability sans-serif fonts.

::comparison{title="Font Families"}
| Type | Variable | Default |
|---|---|---|
| **Display** | `--ink-font-display` | Inter / System |
| **Body** | `--ink-font-body` | Inter / System |
| **Mono** | `--ink-font-mono` | JetBrains Mono |
::

To change fonts, update the `@import` in `src/styles/base.css` and the variable values in your config.

## 3. Site Identity

::comparison{title="Identity Fields"}
| Property | Type | Description |
|---|---|---|
| `name` | `string` | Your brand name. Used in headers, titles, and SEO. |
| `domain` | `string` | The canonical domain (e.g., `yourdomain.com`). |
| `tagline` | `string` | A short pitch for your homepage hero. |
::

## 4. Feature Flags

Toggle site capabilities with simple booleans.

::comparison{title="Feature Flags"}
| Flag | Description |
|---|---|
| `reactions` | Enable the emoji reaction island on posts. |
| `newsletter` | Show the email subscription CTA. |
| `readingProgress` | Display the progress bar during scroll. |
| `knowledgeGraph` | Enable the `/explore` interactive graph. |
| `search` | Build and serve the Pagefind search index. |
| `feedback` | Enable the qualitative feedback widget. |
::

---

[[architecture/system-design|Review the Architecture]] or [[publishing/deployment|Deploy to Cloudflare]].
