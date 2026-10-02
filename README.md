# Tastenet-Pern

**TasteNet** is a food ordering and delivery management system for **Caballeros**, developed as a thesis project using PostgreSQL, Express, React, and Node.js (PERN).

The project now contains a PostgreSQL database, an Express API, and React interfaces for **Customer, Admin, Rider, and SuperAdmin**. The local database is named `tastenet`; its tables live in the `tastenet` schema. The supplied `DeliverySystem.bacpac` was imported into a separate MSSQL snapshot and its data migrated to PostgreSQL. See [database migration notes](database/README.md).

## Run locally

Run these commands from the project root (`TasteNet PERN Stack`). The working local PostgreSQL connection is stored in ignored `backend/.env`. Keep that file private.

```powershell
npm run server
```

In a second terminal, also in the project root:

```powershell
npm run client
```

Open `http://localhost:5173`. The Vite development server proxies `/api` to the backend on port 4000. Health checks are at `http://localhost:4000/health/live` and `/health/ready`.

Vite may use port 5174 if 5173 is already occupied by another local instance. Local development accepts browser requests from ports 5173 and 5174; production accepts only the configured `CLIENT_ORIGIN`.

If dependencies have not been installed on a fresh checkout, first run `npm --prefix backend ci` and `npm --prefix frontend ci`. Keep both server terminals open while using the app; press Ctrl+C in each terminal to stop it.

The UI now ports the burgundy and gold design from [Jeyarrr/TasteNet](https://github.com/Jeyarrr/TasteNet), commit `a7ba463`, including original CSS, logos, food images, website sections, and the role sidebars. Open `/` for the public website or `/login` to sign in. Customer, Admin, Rider, and SuperAdmin accounts automatically open their own interface. See [design port notes](frontend/DESIGN_PORT.md).

Working features include customer registration, profile/password changes, menu browsing, checkout and order history; admin inventory/menu management, bulk restock, ticket creation and rider assignment; rider availability, delivery completion, history and profile; and superadmin dashboard, recipe editing, stock transactions, reports/export, customer/rider management, quota targets and payment settings. The existing eight MSSQL users were migrated with bcrypt-hashed passwords and retain their original usernames and passwords. New staff accounts can be created from SuperAdmin → Delivery (riders) or Settings (admins).

Google OAuth, password reset email/OTP, document/photo uploads, suppliers/purchasing workflows, and automatic stock deduction from recipes still need migration. The React forms and dialogs use the Express API; ASP.NET server controls and source JavaScript are not executable in React.

Run `npm run build`, `npm test`, and `npm run test:ui` to check the build, backend flows, and desktop/mobile layouts. Browser tests use synthetic data and an isolated browser profile. For checks against the running API and actual local database, use `npm --prefix backend run test:live` and `npm --prefix frontend run test:ui:live`. Live checks are read-only except for temporary authentication sessions, which are removed afterward.

For a fresh empty database, configure `backend/.env` from `backend/.env.example`, then run `npm run db:setup`. This creates the `tastenet` database and inserts only safe synthetic starter records. To import a BACPAC snapshot on the same machine, see the migration notes and `npm run db:import-bacpac`.
