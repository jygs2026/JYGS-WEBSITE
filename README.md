# JYGS Clothing

Premium unisex streetwear storefront plus an owner-only admin panel, in one Next.js app.

**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · shadcn/ui · Supabase (from M4)

> Phase 1 has **no online payment gateway**. The order method (WhatsApp enquiry, COD request,
> or catalogue-only) is still undecided; see `orderMode` in `src/config/site.ts`.

## Requirements

- Node.js 20.9 or newer
- npm

## Getting started

```bash
npm install
cp .env.example .env.local   # Supabase values are needed from M4
npm run dev
```

Open http://localhost:3000.

## Scripts

| Script                 | Purpose                                  |
| ---------------------- | ---------------------------------------- |
| `npm run dev`          | Development server (Turbopack)           |
| `npm run build`        | Production build                         |
| `npm run start`        | Serve the production build               |
| `npm run typecheck`    | Generate route types, then `tsc`         |
| `npm run lint`         | ESLint (Next.js + TypeScript rules)      |
| `npm run format`       | Format everything with Prettier          |
| `npm run format:check` | Check formatting without writing         |
| `npm run check`        | Typecheck + lint + format check together |

## Project structure

```
src/
  app/
    (store)/          Public storefront routes (homepage, shop, product, cart, …)
    admin/            Owner admin panel (M3) — protected on the server
  components/
    brand/            Wordmark / logo
    store/            Storefront components
    admin/            Admin components
    ui/               shadcn/ui primitives
  config/             Static site configuration
  hooks/              Reusable React hooks
  lib/
    supabase/         Supabase clients (M4)
    auth/             Auth and role guards (M4)
  mocks/              Temporary mock catalogue data (M1–M3)
  services/           Data access layer — mock now, Supabase from M5
  types/              Domain models (mirror the database schema)
supabase/
  migrations/         SQL migrations (M4)
```

## Conventions

- **Money** is stored as integer paise (₹1 = 100). Use `formatPrice()` from `src/lib/format.ts`.
- **Placeholder imagery** comes from Unsplash (allowed in `next.config.ts`) until real photos are supplied.
- **Secrets:** only `NEXT_PUBLIC_*` variables reach the browser. The Supabase service-role key is server-only.
- Admin access will be enforced on the server and through Supabase RLS, not just by hiding links.
