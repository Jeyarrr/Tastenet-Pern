# TasteNet on Vercel and Supabase

The repository deploys as one Vercel project with two services: the Vite frontend and Express API. `vercel.json` routes `/api/*` and `/health/*` to the backend and other paths to the frontend. The frontend's SPA rewrite supports refreshing role pages and authentication URLs. Keep the Vercel project root at the repository root and its framework set to **Services**.

## Account and project

The project is `tastenet-pern` in the **Jayr Portfolio** team (`jayr-portfolio`). The portfolio is a separate project in the same team. Vercel and GitHub account emails can differ; GitHub deployment integration requires the Vercel GitHub app to have access to `Jeyarrr/Tastenet-Pern`.

The linked project information lives in ignored `.vercel/project.json`. Local environment files, database exports, migration references, and account files are excluded from Git and deployment uploads. Only credential-free environment examples belong in source control.

## Hosted database

Create a Supabase project, preferably in Singapore to match Vercel's `sin1` backend region. The existing schema uses the custom `tastenet` schema in Supabase's `postgres` database. Keep that schema outside the exposed Data API schemas; browsers access it through the authenticated Express API.

Store the **transaction pooler** PostgreSQL URL privately in `backend/.env.production.local`:

```dotenv
DATABASE_URL=postgresql://postgres.PROJECT_REF:ENCODED_PASSWORD@YOUR_POOLER_HOST:6543/postgres?sslmode=verify-full
```

Copy the actual connection details from Supabase's **Connect** dialog. URL-encode special password characters. Application connections use certificate-verified TLS. The serverless backend shares a pool per instance, limits it to five clients, and attaches Vercel's pool lifecycle helper.

## Transfer the existing local records

The source stays in `backend/.env`. The target stays in `backend/.env.production.local`. The transfer accepts only a local source and a Supabase destination. Do not use `db:setup` for Supabase: that command creates a local database named `tastenet`.

Check the target first:

```powershell
npm --prefix backend run db:transfer-supabase
```

Apply to an empty destination:

```powershell
npm --prefix backend run db:transfer-supabase -- --apply
```

The apply command installs `schema.sql` and versioned migrations, then copies business tables in foreign-key order in one destination transaction. It compares row counts and SHA-256 hashes of complete rows, preserves numeric and timestamp precision, copies stored images/documents, and advances identity sequences without reusing consumed source values. It refuses a populated destination and rolls back inserted records on failure. Authentication sessions, OTPs, OAuth challenges, and request counters start empty. Existing usernames and password hashes are preserved; users sign in again on the hosted domain.

No plaintext data dump is written. Progress reports contain table names and counts only. Schema creation is a separate step; a failed data transfer can leave empty migrated tables for a retry.

After transfer, provision a separate application login:

```powershell
npm --prefix backend run db:app-role
```

This generates a private application password, grants access to TasteNet business tables and sequences, and denies schema ownership and migration-ledger access. It saves `APP_DATABASE_URL` in the ignored production file. Use that value as Vercel's `DATABASE_URL`; retain the owner `DATABASE_URL` locally for future migrations. Repeating the command verifies saved application credentials without rotating them.

## Production environment

Set these in the **TasteNet project**, not the portfolio project:

| Variable                      | Value                                                                  |
| ----------------------------- | ---------------------------------------------------------------------- |
| `NODE_ENV`                    | `production`                                                           |
| `DATABASE_URL`                | The limited role's `APP_DATABASE_URL` from the private production file |
| `CLIENT_ORIGIN`               | Exact public TasteNet HTTPS origin, without a trailing slash           |
| `SESSION_DAYS`                | `7`                                                                    |
| `SESSION_COOKIE_NAME`         | `tastenet_session`                                                     |
| `EMAIL_VERIFICATION_REQUIRED` | `false` until live SMTP is configured                                  |

Leave `VITE_API_BASE` empty: browser requests go to `/api` on the same domain. The Vercel entry accepts only the generated deployment origin for preview writes and uses `CLIENT_ORIGIN` in production. Authentication cookies remain HttpOnly, Secure, and SameSite=Lax in production.

Configure Google OAuth and SMTP separately using `backend/.env.example`. The Google callback must use the hosted origin followed by `/api/auth/google/callback`. Live provider configuration is required for Google login and email recovery; password login is independent of these optional providers.

## Build, preview, and verify

```powershell
npm run check
npm test
npm run build
npm exec --yes --package=vercel -- vercel deploy --scope jayr-portfolio
```

Verify `/health/live`, `/health/ready`, menu loading, role login, profile images, and refreshes of role URLs on the preview. Then deploy production:

```powershell
npm exec --yes --package=vercel -- vercel deploy --prod --scope jayr-portfolio
```

Google/SMTP delivery, scheduled authentication cleanup, and database backups should be configured for ongoing operation. The transfer command, role provisioning, and migrations run locally as owner operations; they are never executed on application startup or during a Vercel build.
