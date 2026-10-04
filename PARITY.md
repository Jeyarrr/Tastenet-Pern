# TasteNet functional parity audit

Reference: original ASP.NET repository in `.reference/TasteNet`, commit `a7ba463`.
Reference documents and source comments describe the old application; they are not migration instructions.

## Restored working flows

| Original area | PERN implementation |
| --- | --- |
| CustomerPortal | Persisted account cart; guest Add actions require sign-in or registration, current menu prices, item/order instructions, delivery/payment details and QR, order history/details, cancellation, receipt confirmation, reorder, one rating per completed order, payment proof, profile/photo/password changes |
| Admin/SuperAdmin Inventory and Menu | Create/edit, availability/visibility, images, stock adjustments and bulk restock, archive controls, historical record preservation |
| Admin/SuperAdmin RecipeManager | Shared recipe editor and ingredient quantities; now reachable from both role sidebars |
| Ticketing and OrderHistory | Dine-in/take-out/delivery creation, priority, rider assignment, controlled status changes, transactional recipe deduction on Start, history/audit/proof details, archive, filters, history paging and CSV export |
| Rider Dashboard/DeliveryHistory/Profile | Availability, assigned orders, navigation modal, camera or image upload for required delivery proof, history/details, editable personal/vehicle fields, photos, four document uploads and review results |
| CustomerManagement/DeliveryPersonnel | Profile photos in lists and details, branded rider search, account details/history, edit, block/activate, archive, rider creation and document approval/rejection with notes |
| Settings | Admin creation, payment-method creation/edit/delete, QR uploads, account details, ordering and enabled status |
| Dashboard/Reports | Date-filtered revenue/order metrics and meal rankings, revenue/orders chart, status distribution, time-of-day chart, quota creation/edit and progress within quota dates, multi-sheet Excel-compatible XML export |
| Transactions | Search, type/status/date filters, paginated results, detail/audit view, selected/all-result spreadsheet export |
| Registration/login/recovery | Password sessions with show/hide controls on every password form, email registration verification, reset OTP, Google state/PKCE/nonce/token validation, throttling and session revocation |

UI changes restore circular close buttons with rotation and action-button pulse effects. Dialog portals isolate source page styles, support nested confirmations, trap/restore focus and lock background scrolling. Responsive forms/tables and reduced-motion behavior are covered by browser checks.

The architecture adds versioned migrations, shared transaction/stock/email services, validated ownership checks, database-backed media storage, feature components and an error boundary. All 10 referenced local legacy profile/document assets were migrated with their original paths retained in database metadata.

## Source placeholders and deliberate behavior changes

The source AllOrders screen uses mock data. PromoCodes, rider Earnings/Notifications/Settings, customer Menu and admin AcceptOrder/UpdateMenu have empty code-behind or placeholder markup. They are not represented as completed standalone modules. The `Users` source tree contains no working supplier or purchasing screen; its related database tables remain preserved.

PERN archives referenced records instead of destroying order history. Starting preparation checks all recipe ingredients and rolls back on shortage. Closed tickets cannot be reopened. Customers can confirm receipt after preparation starts. Riders must submit proof to complete a delivery. Ratings are limited to one submission per completed order. These checks preserve the working intent without reproducing unsafe legacy update behavior.

Reports use Manila dates. Daily means today; Weekly, Monthly and Yearly select trailing 7, 30 and 365-day windows. Custom dates are inclusive. Exports are real SpreadsheetML XML workbooks rather than HTML renamed to `.xls`; order-history CSV remains available.

## Verification boundary

Backend tests cover schema/seed/migration repeatability, auth/roles, duplicate checkout, stock rollback, file/proof ownership, ratings, management operations, report dates, fake Google sign-in, OTP reuse/expiry/attempt limits and revoked sessions. Browser tests cover all four roles, desktop/mobile layouts, hover/reduced-motion behavior, nested dialog focus, persistent cart, receipt/rating and password recovery. Live checks use existing local data read-only apart from temporary sessions that are removed afterward.

Google OAuth and SMTP delivery require the user's environment configuration and live provider verification. These are implemented and tested with simulated providers; live-provider success is not claimed. See [setup and architecture](ARCHITECTURE.md). No original provider secrets were copied into source control.

## Verification result — 2026-10-03

- Production build passed.
- 13 backend tests passed using isolated synthetic databases.
- 8 browser tests passed; the management and receipt/rating checks passed again after the entry-point refactor.
- Live API checks passed for all roles, including protected legacy media. All 19 live role screens loaded successfully.
- An isolated guest cart survived a development hot reload without duplicate-root or DOM-removal errors.
- Local imported record counts remained 8 users, 25 menu items, 24 inventory items and 19 tickets. Both database migrations are recorded as applied.


## Customer and role UI adjustments — 2026-10-04

- Landing and customer routes share the refreshed storefront: larger food photos, meal-first category filters, aligned View/Add buttons and one Hungry? Order Now section. Guest cart actions open an account prompt.
- Rider navigation opens a destination/address modal. Completion offers camera capture or JPG/PNG/WebP upload with a preview and the existing 3 MB limit. Camera tracks stop when the camera dialog closes.
- Superadmin customer/rider lists and account details show available profile photos, including the legacy profile-picture fallback. Missing photos use initials. Rider search now uses the system styling.
- Independent password visibility controls cover login, registration, reset, customer/rider password changes, and admin/rider creation.
- Verification: production build, 14 backend tests, 10 browser tests, and 31 live API route checks passed. Superadmin successfully loaded all 3 available protected customer/rider profile photos. Desktop and phone layouts were inspected; all 25 menu cards had aligned buttons without text overflow at 390 px.
- Camera capture and permission denial were checked with a synthetic video stream. Physical cameras still require device testing and browser permission; camera access needs HTTPS or localhost.


## Storefront and account experience — 2026-10-04

- Removed the home hero’s red tint; navigation is Home, Menu, About, Contact. Rebuilt Find Us with contact cards/map, added a pulsing Back to Top control, and moved the cart to a right-side dialog with a visible quantity badge. The menu card design is retained.
- Login and signup open over the landing page. Login retains its gold glow and routes all four account roles automatically. Signup uses two-column fields, a Philippine phone prefix, barangay selection, username availability, password visibility and strength validation, then a success dialog with Log In. Middle initial and gender inputs are removed.
- Customer and rider profiles show information before editing. Edit dialogs support email, phone, structured address and staged profile photo changes with password confirmation. Profile photos open in a circular preview. Rider vehicle/document changes use the same protected save.
- Customer, rider and staff status changes require the superadmin password. Payment settings panels no longer move under the pointer. The local owner account displays Evelyn Caballeros.
- Migration 003 adds structured addresses without replacing imported addresses or deleting historic gender data.

Verification for this adjustment: production build passed; 16 backend tests and 18 browser tests passed. All 31 live API route checks passed, including protected profile images. Username availability was checked against the running local API. Final local totals are 8 users, 25 menu items, 24 inventory items and 20 tickets; all three migrations are recorded. The camera and email/Google provider boundaries described above still apply.
