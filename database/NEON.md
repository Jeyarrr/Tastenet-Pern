# TasteNet on Neon

The production Vercel database was switched to Neon on November 7, 2026.

- Project: TasteNet (`green-term-74986598`), AWS Singapore, PostgreSQL 17.
- Source: the local database selected by the owner, not the paused Supabase database.
- Verified copy: 23 business tables, including 8 users, 21 tickets and 11 media files.
- Sessions, OTPs, rate limits and the source migration ledger are excluded. Users sign in again.
- Online-only Supabase records (including any online-only reviewer accounts) are not part of this copy.
- All 31 role route checks and protected profile image checks passed against the live site.
- The existing published Vercel revision was rebuilt with the Neon connection. Local UI edits were not published.

## Private configuration

`backend/.env.neon.local` contains DIRECT_DATABASE_URL (owner, direct), DATABASE_URL (owner, pooled), and APP_DATABASE_URL (limited application role, pooled). It is ignored by Git. Vercel Production and Preview use APP_DATABASE_URL as their secret DATABASE_URL.

`backend/.env` still uses local PostgreSQL for development. `backend/.env.production.local` retains the previous Supabase connection for recovery. Do not paste or commit credentials.

## Transfer tools

These commands are for a NEW EMPTY Neon destination, not a repeat import into the populated production database:

```powershell
npm run db:transfer-neon -- --local-source
npm run db:transfer-neon -- --local-source --apply
npm --prefix backend run db:app-role -- --neon
```

For a resumed Supabase source, use `--supabase-source` instead. Never silently fall back to local records. The transfer uses a read-only source snapshot, checks schema/migration compatibility, verifies table content hashes, preserves sequence values and media, refuses occupied destinations, and rolls back failed record copies. Pause source writes during a future final cutover.

Use a direct owner URL for migrations and the limited pooled application URL for serving requests. Do not deploy the owner URL. After a later schema migration, review new table grants for the application role.

The existing local smoke test also accepts SMOKE_BASE_URL to check a deployed installation. Its DATABASE_URL must point to that same installation; it creates temporary sessions and deletes them afterward.
