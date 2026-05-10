---
title: "RBAC Belongs in the Kernel"
date: 2026-04-17
author: kasra
tags: ["technology", "agents"]
description: "Why access control can't be a plugin, what we learned from Supastarter and MakerKit, and how 45 lines of TypeScript solved it."
status: published
---

When we were planning the Inkwell plugin system, the question came up: should RBAC be a plugin or part of the kernel?

The instinct was: "everything should be a plugin." Plugins are modular. You can swap them. The kernel stays clean.

That instinct was wrong for access control.

## What the SaaS Starters Do

Before deciding, we looked at how other TypeScript SaaS starters handle this in 2026. There are three worth studying:

| Starter | Auth Library | RBAC Location | Granularity |
|---------|-------------|---------------|-------------|
| **Supastarter** | better-auth | Per-route middleware, roles in auth session | Organization-level roles (owner/member/guest) |
| **MakerKit** | Supabase Auth | RLS policies + client-side guards | Team roles with per-resource policies |
| **ixartz boilerplate** | Clerk | Clerk metadata + component-level guards | Basic owner/member split |

All three ship RBAC. None of them ship it as a swappable plugin. That's the tell.

## Why Plugin RBAC Breaks

We prototyped plugin RBAC for about two days before abandoning it. Three failure modes appeared immediately.

**Plugins can't check each other's permissions.** If the booking plugin needs to know whether the current user can see the billing plugin's data, it needs a shared authority. If RBAC lives in a plugin, there's no authority — just two plugins that know nothing about each other.

**Nav filtering needs kernel access.** The dashboard renders a navigation list from registered plugins. Filtering that list by role — hiding the analytics tab from viewers, hiding billing from members — has to happen before any plugin renders. The kernel builds the nav. The kernel needs the role check.

**Middleware runs before plugins load.** The Hono router applies middleware in registration order. RBAC middleware has to run on every request, before any plugin route handler. If RBAC is a plugin, it has to load before other plugins, depend on load order, and hope nothing registers a route before it. That's fragile.

The conclusion: RBAC is a prerequisite, not a feature. It belongs in the kernel.

## The 45-Line Solution

`roles.ts` is deliberately small. It doesn't try to be a permissions engine.

```typescript
// kernel/roles.ts

export type InkwellRole = 'owner' | 'admin' | 'manager' | 'member' | 'viewer'

const ROLE_HIERARCHY: Record<InkwellRole, number> = {
  owner:   50,
  admin:   40,
  manager: 30,
  member:  20,
  viewer:  10,
}

export function hasRole(userRole: InkwellRole, required: InkwellRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[required]
}

export function requireRole(required: InkwellRole) {
  return async (c: Context, next: Next) => {
    const role = c.get('userRole') as InkwellRole | undefined
    if (!role || !hasRole(role, required)) {
      return c.json({ error: 'Forbidden' }, 403)
    }
    return next()
  }
}
```

`hasRole()` is one comparison. The hierarchy is a number. There's no matrix, no permission strings, no resource-scoped policy objects. We don't need those — Inkwell's access model is role-based, not attribute-based. Adding policy objects would be solving a problem we don't have.

## How Plugins Use It

Each plugin declares a `requiredRole` in its manifest:

```typescript
// plugins/analytics/manifest.ts
export const manifest: InkwellPlugin = {
  id: 'analytics',
  name: 'Analytics',
  requiredRole: 'manager',  // viewers and members don't see this
  routes: analyticsRouter,
  navItem: { label: 'Analytics', href: '/analytics', icon: 'chart' },
}
```

The plugin loader reads `requiredRole` and wraps the plugin's routes with `requireRole(manifest.requiredRole)` automatically. Plugin authors don't write middleware. They declare intent.

The nav uses the same field to filter client-side. The role is stored in localStorage after login (a signed JWT claim, not a raw string), and the shell reads it before rendering the nav. An analytics plugin that declares `manager` simply doesn't appear in the nav for viewers.

## What This Gets You

The owner of a dental booking site using Inkwell can add staff as `member` role — they see appointments and patient notes, but not billing or analytics. That constraint costs the implementer zero code. It came from the manifest declaration and a 45-line kernel file.

The Agnite Studio post on RBAC design in SaaS makes the same observation: role hierarchies outperform flat permission sets for most B2B products because the roles map to org charts that already exist in the client's head. Owner → Admin → Manager → Member → Viewer is something a dental office manager understands immediately.

The failure mode we avoided: a permissions system so flexible that every deploy requires a permission audit. Forty-five lines won't cover every access control requirement. But they cover 90% of what Inkwell verticals need, and the 10% that needs more can be handled inside individual plugins with their own guards.

Keep the kernel small. Keep RBAC in the kernel.
