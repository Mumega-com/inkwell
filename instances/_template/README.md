# Inkwell Instance Template

This directory is the starter scaffold consumed by `sos init` (Step B).
It is NOT a deployable site on its own — placeholders must be interpolated first.

## Six Placeholders

| Token         | Example value       | Where used                                   |
|---------------|---------------------|----------------------------------------------|
| `{{SLUG}}`    | `acme`              | wrangler project name, workflow names, config |
| `{{LABEL}}`   | `Acme Co`           | site title, brand name, SEO org name         |
| `{{DOMAIN}}`  | `acme.com`          | URLs, SITE_URL var, worker URL               |
| `{{EMAIL}}`   | `owner@acme.com`    | about page contact                           |
| `{{INDUSTRY}}`| `consulting`        | SEO knowsAbout, about page                   |
| `{{TAGLINE}}` | `Doing the thing.`  | meta description, hero subtitle              |

## sos init Flow

1. `sos init --slug acme --label "Acme Co" --email owner@acme.com ...` runs Step B.
2. Step B copies `instances/_template/` → `instances/acme/`.
3. Every text file in the copy has the six tokens replaced with real values.
4. `npm run build` is executed at the Inkwell repo root (Astro SSG → `dist/`).
5. `wrangler pages deploy dist --project-name acme` pushes to Cloudflare Pages.
6. Step D then writes `standing_workflows.json` from the interpolated stub.

## Adding Pages / Content

After init, edit files inside `instances/<slug>/` freely.
The `pages/index.astro` starter renders a hero; add routes under `src/pages/` as usual.
