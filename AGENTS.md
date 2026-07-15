# Project Agent Instructions

Before changing this project, read `DEVELOPMENT_FRAMEWORK.md`.

Preserve these rules unless the user explicitly approves a framework change:

- Keep Next.js App Router, Supabase Postgres, Cloudflare R2, and the current server-session security model.
- Keep public routes at `/c/[companySlug]` and `/c/[companySlug]/p/[productCode]`.
- Keep platform administration under `/admin` and guarded server APIs.
- Protect every write with session, role, and tenant-scope checks.
- Keep `/` as the unified login; only the server resolves the destination.
- Keep sequential company numbers internal and public/company URLs opaque.
- Fail closed for unknown, inactive, expired, or unreadable tenants.
- Keep `public_contact_phone` separate from internal `contact_name` and `contact_note`.
- Preserve category-scoped product codes such as `HW-001`.
- Preserve platform-admin access to company product workspaces and guarded image replacement.
- Do not add cart, checkout, online payment, or public payment QR codes without an explicit scope change.
- Preserve at least 6 visible products at 390×844 in the default public catalog.
- Update schema, types, API, UI, cache invalidation, and tests together when data shape changes.
- Run `npm run build` after code changes and verify the affected user flow.
- Keep Markdown current-state only: replace obsolete text instead of appending logs, status ledgers, or completed work.

`DEVELOPMENT_FRAMEWORK.md` is the source of truth. Git history is the source for past changes.
