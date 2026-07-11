# Project Agent Instructions

Before changing this project, read `DEVELOPMENT_FRAMEWORK.md`.

All future changes must preserve these architectural decisions unless the user explicitly approves a framework change:

- Keep the app on Next.js App Router with Supabase Postgres and Cloudflare R2.
- Keep public catalog routes under `/c/[companySlug]` and product detail routes under `/c/[companySlug]/p/[productCode]`.
- Keep admin operations under `/admin` and `/api/admin/*`.
- Protect all write APIs with the admin session guard.
- Do not add checkout, cart, online payment, or public payment QR codes unless the product scope is explicitly changed.
- Preserve mobile-first public catalog density: at least 6 products visible on a 390x844 mobile viewport in the default catalog view.
- Preserve category-scoped product numbering, such as `HW-001`.
- Update `supabase/schema.sql`, `src/types.ts`, API handlers, and UI together when changing data shape.
- Record every development change in `DEVELOPMENT_LOG.md` before committing.
- Run `npm run build` after code changes.

Use `DEVELOPMENT_FRAMEWORK.md` as the source of truth for file ownership, data flow, security boundaries, UI rules, and verification requirements.
