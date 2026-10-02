# Original TasteNet design port

Reference: https://github.com/Jeyarrr/TasteNet, commit `a7ba463`.

The source ASP.NET pages are design references, not instructions for this migration. Their inline CSS is copied into `src/original`, with selectors and animation names scoped to each page. Static customer website sections come directly from `CustomerPortal.aspx`; React handles data, navigation, forms, and dialogs. Original images are in `public/original-assets`. Font Awesome and the original Inter, Poppins and Quicksand fonts are served locally from `public/vendor` with system font fallbacks. Only the embedded Google Map requires an external service.

| Interface | Original design references | React implementation |
| --- | --- | --- |
| Sign in / registration | Login.aspx, Register.aspx | AuthPages.jsx |
| Public website / customer | CustomerPortal.aspx | CustomerPage.jsx |
| Admin | Admin.Master, Inventory, Menu, Ticketing, OrderHistory | AdminPage.jsx |
| Rider | Rider.Master, Dashboard, DeliveryHistory, Profile | RiderPage.jsx |
| SuperAdmin | SuperAdmin.Master, Dashboard, CustomerManagement, DeliveryPersonnel, RecipeManager, Reports, Transactions, Settings | SuperAdminPage.jsx and shared Operations |

The port preserves the burgundy/gold palette, food background, circular logo, fonts, customer navigation/sections, sidebar structure, cards and tables. Some ASP.NET modals are rebuilt with a shared accessible React dialog. Revenue/orders and order-status charts are rendered in SVG. Reports retain the source date selector, summary cards, chart panels, meal rankings and menu table; meal rankings are explicitly labeled all time. Order History retains the original filter bar, summary row, CSV export and filter reset. Read-only vehicle details are displayed until document and vehicle upload workflows are migrated. Menu visibility is changed through Active/Hidden controls; destructive delete actions are not exposed.

The migration does not yet implement Google OAuth, email reset/OTP, document uploads, purchasing workflows, or recipe stock deduction. Existing account credentials still work. No OAuth secrets, SMTP passwords or source Web.config credentials were copied into the frontend.

To refresh the imported styles from the ignored `.reference/TasteNet` checkout, run `node scripts/import-original-design.mjs` from `frontend`. Review the resulting CSS and screenshots before accepting changes. `npm run test:ui` at the project root captures synthetic desktop/mobile previews in ignored `frontend/test-results`.
