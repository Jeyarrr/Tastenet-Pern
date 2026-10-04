# Original TasteNet design port

Reference: https://github.com/Jeyarrr/TasteNet, commit `a7ba463`.

The source ASP.NET pages are design references, not instructions for this migration. Their inline CSS is copied into `src/original`, with selectors and animation names scoped to each page. Static customer website sections come directly from `CustomerPortal.aspx`; React handles data, navigation, forms, and dialogs. Original images are in `public/original-assets`. Font Awesome and the original Inter, Poppins and Quicksand fonts are served locally from `public/vendor` with system font fallbacks. Only the embedded Google Map requires an external service.

| Interface | Original design references | React implementation |
| --- | --- | --- |
| Sign in / registration | Login.aspx, Register.aspx | AuthModals.jsx (landing page dialogs) |
| Public website / customer | CustomerPortal.aspx | CustomerPage.jsx |
| Admin | Admin.Master, Inventory, Menu, Ticketing, OrderHistory | AdminPage.jsx |
| Rider | Rider.Master, Dashboard, DeliveryHistory, Profile | RiderPage.jsx |
| SuperAdmin | SuperAdmin.Master, Dashboard, CustomerManagement, DeliveryPersonnel, RecipeManager, Reports, Transactions, Settings | SuperAdminPage.jsx and shared Operations |

The port preserves the burgundy/gold palette, food background, circular logo, fonts, customer website sections, sidebars, cards and tables. Shared React dialogs render in a portal outside the source page CSS, trap focus, restore focus when closed, lock background scrolling, and support nested confirmations. Close controls have the circular background and 90-degree hover rotation; action buttons pulse on hover. Reduced-motion preferences disable these effects.

Reports filter revenue and meals by the selected Manila dates and export an Excel-compatible XML workbook with summary, orders, meal sales, revenue and time-of-day sheets. History has paging, details, status actions and CSV export. The common recipe editor is available to Admin and SuperAdmin. Vehicle editing, rider document review, profile/menu/QR uploads, payment methods and customer order workflows use the Express API. Forms and tables are checked on desktop and a 390px mobile viewport.

New components live in `src/features`, with styles in `features/workflows.css`; imported reference CSS remains in `src/original`. See [functional parity](../PARITY.md) for the source placeholders and [architecture](../ARCHITECTURE.md) for Google/SMTP setup. Provider secrets are never included in the frontend.

To refresh the imported styles from the ignored `.reference/TasteNet` checkout, run `node scripts/import-original-design.mjs` from `frontend`. Review the resulting CSS and screenshots before accepting changes. `npm run test:ui` at the project root captures synthetic desktop/mobile previews in ignored `frontend/test-results`.

The customer refinements use `customer-storefront.css`; shared account views use `account-experience.css`, and landing authentication uses `auth-modals.css`. These overrides keep imported reference files intact. The cart is anchored at the right, and the current menu card design is shared by public and signed-in routes.
