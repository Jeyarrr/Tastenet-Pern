# TasteNet database migration

## Current upgrades

The initial schema has 23 tables. Three versioned migrations in `database/migrations` add workflow fields, ratings, protected media, OAuth challenges, request counters, legacy media-path metadata, structured account addresses and the migration ledger (28 tables total). Run `npm run db:migrate` after pulling updates. `npm run db:setup` also applies these upgrades on a new local installation.

The existing local database has all three upgrades applied. Its original user/menu/inventory/order rows are retained. Ten referenced legacy profile/document files were copied into `media_files`, and their application references now use authorized `/api/files/:id` URLs. Original file paths are retained in `source_path`; the source files were not deleted. See [architecture notes](../ARCHITECTURE.md) for the importer and file permissions.

## Original import

The authoritative source is `DeliverySystem.bacpac`, supplied in the user's SQL Server Management Studio DAC Packages folder. Its `model.xml` describes 22 MSSQL tables; [mssql-source-schema.md](mssql-source-schema.md) lists every column and type. `schema.sql` creates those 22 tables in PostgreSQL's `tastenet` schema, plus `auth_sessions` for the new API.

The BACPAC was imported into a separate SQL Server LocalDB database named `DeliverySystem_BacpacSnapshot`, leaving the original `DeliverySystem` database untouched. `backend/scripts/import-bacpac.js` reads that snapshot through an in-memory PowerShell pipe and inserts its data into the local PostgreSQL `tastenet` database. Legacy user passwords and the separate `AdminAccounts.PasswordHash` values were plaintext in the source despite the latter's name; both are bcrypt hashed before PostgreSQL insertion. The source rows are never written to a plaintext export file. Existing users keep their original login passwords, now checked against hashes.

The migration includes 8 users, 25 menu items, 79 delivery fees, 24 inventory items, 19 tickets, their related records, and the source settings and audit records. Empty source tables remain empty. MSSQL identity IDs are preserved; PostgreSQL identity sequences are advanced after import. The source `TransactionAudit.TransactionID` contains historical IDs absent from `InventoryTransactions`, so this field is preserved without an invented foreign key. Source `Tickets.UpdatedAt` is null for all rows; imported rows use their creation time for the required PostgreSQL `updated_at` value.

The source BACPAC lacks `PaymentMethods.Status` and `QRPhoto`, although the ASP.NET code references them. The PostgreSQL schema keeps these fields with defaults so the migrated UI can work. `ApplicationSettings` are copied as data, but the backend currently reads its connection and session configuration from environment variables.

`seed.sql` is for a new empty development database only. Once real data is imported, `db:setup` skips the synthetic seed. The BACPAC importer refuses to overwrite a database with data outside the initial sample state. Its `--replace-initial-import` switch was used once during development with strict row-count guards; it is not part of normal setup.
