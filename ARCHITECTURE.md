# TasteNet implementation notes

## Application boundaries

- React role pages compose domain features under `frontend/src/features`. Shared shells, notices, forms, and the accessible dialog stack live in `frontend/src/components`. `frontend/src/lib/api.js` sends cookie credentials and normalizes API errors. A root error boundary provides a recoverable screen for rendering failures. `frontend/src/styles/index.css` defines the stylesheet order centrally.
- Express routes validate inputs with Zod, authenticate database-backed sessions, and enforce role and record ownership. `services/transaction.js` handles commit/rollback; `services/stock.js` locks ingredient rows in a stable order before deducting a recipe.
- PostgreSQL is authoritative for prices, order totals, stock, user roles, sessions and file permissions. The signed-in browser cart is a draft. Public menu Add actions require sign-in or registration. Checkout accepts an idempotency key to prevent a repeated request from creating another ticket.
- Files are stored as `bytea` with an owner, purpose and optional ticket ID. Uploaded files are limited to 3 MB. JPG/PNG/WebP signature checks apply; PDF is accepted only for rider documents. Menu and payment QR images are public. Profile photos, rider documents and proofs require the corresponding account/role/order access. No uploaded files rely on server-local disk.

## Database upgrades

`database/schema.sql` is the initial schema. `database/migrations/*.sql` contains additive upgrades. Run `npm run db:migrate` against an existing database before starting the updated API. The runner records filenames and SHA-256 checksums in `tastenet.schema_migrations`; applied SQL files must not be edited. Add a new migration for later changes.

`npm run db:setup` creates a fresh local `tastenet` database, installs the initial schema and all migrations, and inserts synthetic seed records only if no application data exists. It does not replace an existing import.

The legacy-media importer reads only files beneath the ignored `.reference/TasteNet` directory. Preview with `npm --prefix backend run db:import-media`; apply with `npm --prefix backend run db:import-media -- --apply`. It copies referenced assets into protected storage and keeps each original path in `media_files.source_path`. Source files remain intact. In the current local database, 10 referenced profile/document files were recovered; a second run skips those references.

## Shared UI and delivery photos

The public landing page and customer portal render `CustomerPage` with the same storefront stylesheet. Nested `/login` and `/register` routes display accessible dialogs over the landing page; successful login routes to the authenticated account’s portal. Authentication controls cart additions. `PasswordInput` supplies independent, accessible show/hide controls for every password form. `Avatar` displays a protected profile image or initials when unavailable.

Rider navigation uses a shared modal with pickup/drop-off details, a destination map and a Google Maps directions link. Delivery completion accepts a device image or a camera capture through the same authenticated upload service. Camera streams are stopped on dialog cleanup, including cancellation. Capture requires browser permission and a secure context (HTTPS or localhost); image upload remains available if camera access is denied. Tests use synthetic video, not a physical camera.

Forgot Password opens a recovery dialog from the login card without navigating away or discarding the entered login identifier. The existing `/forgot-password` URL also opens the dialog over the shared landing page. Close, Escape and Back to Sign In return to login; password visibility, OTP validation and reset session revocation are retained.

Storefront scroll motion is decorative: content stays visible if observer callbacks never arrive, and reduced-motion preferences disable animation. Shared staff menu styling keeps cards stationary during scrolling and hover, while retaining action-button feedback. Browser regression checks cover both staff roles with a multi-category menu on desktop and mobile.

## Order lifecycle

An Open ticket can start preparation or be cancelled. Starting preparation deducts recipe ingredients once, records stock transactions and appends status history atomically. A shortage rolls back the entire operation. In Progress can be completed or cancelled. Closed orders cannot be reopened through the API.

Customers can cancel their own Open orders and confirm receipt of their own In Progress orders, matching the original portal. Riders can complete assigned In Progress deliveries only after uploading a delivery proof. Staff can complete tickets from Ticketing or Order History. Cancellation after preparation does not return consumed ingredients to stock; use an explicit inventory adjustment if stock is physically returned.

Ratings require an owned, completed order and are accepted once per order. Archive actions retain historical rows. An ingredient still referenced by a recipe cannot be removed. A rider with active assignments must have deliveries reassigned before account removal.

## Account editing and confirmation

`AccountProfile` presents customer and rider information read-only. Editing stages photos and rider documents, then submits changes in one password-confirmed transaction to `PATCH /api/auth/profile`. Structured house/street/barangay values live in `users.address_details` (migration 003) while `users.address` remains compatible with checkout and historical imports. Existing free-form addresses are kept until explicitly replaced. Barangay choices come from the imported delivery-fee catalog. Gender is excluded from active forms and account APIs; its legacy database column remains for preservation of imported records.

Email and phone changes require the current account password. Changing email resets its verification flag. Username uniqueness is case-insensitive and enforced by database indexes; the signup form also checks availability. New passwords require 12+ characters including uppercase, lowercase, a number and a symbol; existing credentials still work for login. Password confirmation is rate-limited and checked by the server, including legacy photo/vehicle/document endpoints.

Superadmin activation, deactivation and archival require the signed-in superadmin’s password. Deactivation revokes the target account’s sessions, so reactivation does not revive old sessions. The current local store-owner account display name is Evelyn Caballeros.

## Google and email configuration

Use the commented settings in `backend/.env.example`. Real credentials belong in ignored `backend/.env` locally and private environment settings when deployed.

For Google, configure `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_REDIRECT_URI`. Register the exact redirect URI in the provider; locally, use the same browser origin as the frontend, for example `http://localhost:5173/api/auth/google/callback`. Configure `CLIENT_ORIGIN` to that origin. The implementation uses state, a nonce, PKCE, ID-token audience validation and a single-use database challenge. See [Google OpenID Connect documentation](https://developers.google.com/identity/openid-connect/openid-connect).

For email, configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_FROM`, and provider-required `SMTP_USER`/`SMTP_PASSWORD`. Enable `EMAIL_VERIFICATION_REQUIRED=true` after delivery is configured. Until then, direct customer registration remains available and reset email returns a clear unavailable message. See [Nodemailer SMTP settings](https://nodemailer.com/smtp).

OTP codes expire after ten minutes, allow at most five failed attempts, and are consumed once. Password reset revokes existing sessions. Authentication request counters are stored in PostgreSQL. Schedule `npm --prefix backend run auth:prune` to remove expired sessions, challenges, OTP payloads and rate-limit records.

Live Google authorization and SMTP delivery still need verification using the user's provider accounts. Automated tests use injected fake providers and never send email.

## Verification and deployment limits

- `npm test`: isolated PostgreSQL-compatible tests using PGlite, synthetic records and fake providers. Covers schema/migrations, roles, login, stock rollback, duplicate checkout, private media, proof ownership, ratings, document review, payments, quotas, reporting dates and session invalidation.
- `npm run test:ui`: isolated Edge/Chromium browser checks using synthetic API fixtures, desktop/mobile layouts, dialog focus, hover/reduced-motion behavior and restored interactions.
- `npm --prefix backend run test:live` and `npm --prefix frontend run test:ui:live`: read-only checks against the actual local database, apart from temporary sessions that are removed afterward.

List APIs currently return complete authorized collections so reports do not silently truncate at 200/500 records. Orders and transactions paginate their rendered tables. Server-side pagination and aggregate reporting should be introduced with measured volume requirements before a large deployment.

Keep the deployed browser and API on the same origin with `/api` routing for the HttpOnly SameSite=Lax session cookie. The Vercel services configuration builds the frontend and backend separately on one domain. `backend/src/index.js` exports the app with a shared, lifecycle-managed PostgreSQL pool; the local `server.js` continues to listen on its development port. Supabase URLs use verified TLS. See [deployment steps](DEPLOYMENT.md) for database transfer, production settings, and hosted verification. Backups and live provider verification remain operational setup.
