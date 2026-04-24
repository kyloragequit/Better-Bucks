# Better Bucks

## Overview
Better Bucks is a multi-tenant, full-stack employee incentive and rewards management system. It allows organizations to manage employee rewards, point balances, and transactions through a tiered subscription model. Employees can track points, use an internal store, or submit orders, while administrators handle user management, balance adjustments, and order approvals. The system features a robust role-based access control (RBAC) hierarchy, including prime administrators who oversee the entire organization. The project aims to provide a comprehensive solution for employee recognition, fostering engagement and productivity within organizations.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter
- **State Management**: TanStack React Query
- **Styling**: Tailwind CSS with shadcn/ui components (New York style)
- **Build Tool**: Vite
- **Architecture**: Page-based with role-specific layouts (`EmployeeLayout`, `AdminLayout`).

### Backend
- **Framework**: Express.js with TypeScript
- **Authentication**: Passport.js (session-based)
- **API Design**: RESTful endpoints with Zod validation.
- **Data Abstraction**: `IStorage` interface for flexible data store integration.

### Data Storage
- **Database**: PostgreSQL with Drizzle ORM.
- **Schema**: Includes tables for organizations, users, departments, transactions, transaction categories, monthly reports, orders, store items, wishlists, blog posts, goals, goal notifications, and referral codes.
- **File Uploads**: Multer-based to local storage.
- **Migrations**: Drizzle-kit.

### Authentication & Authorization
- Session-based authentication with `employee`, `admin`, and `prime_admin` roles.
- Email or Phone verification (Twilio SMS) for new users.
- Passkey (WebAuthn) support for enhanced security.
- Passwordless employee login via Site ID or QR Code.
- Feature flags for prime admins to control employee store, order requests, and password creation.

### Key Features
- **Goals System**: Prime admins can create time-based or quantity-based goals with Bucks rewards.
- **Inbox (Developer Dashboard)**: All RFI and affiliate form submissions are now stored in the database with `email_sent` tracking. A developer-only "Inbox" tab on the developer dashboard lists every submission with name, email, type, and sent status badge. Resend button triggers a re-send of the notification email and marks the record as sent. Affiliate applications now persist to `affiliate_applications` table (previously email-only, submissions were lost if email failed).
- **Surveys System**: Admins can create multi-question surveys (multiple-choice & written) for employees. Surveys can be optionally linked to an active quantity goal — each submission auto-increments the goal's progress. Results dialog shows response breakdown per question, respondent list, and an "Export PDF" button (client-side jsPDF export). Employee survey cards show "Contributes to: [Goal Name]" when linked. Fixed a query bug where `= ANY()` malformed SQL caused 500 errors on survey listing — replaced with `inArray()` from drizzle-orm throughout.
- **Employee Store**: Admins curate items for employees to purchase with Bucks, including a wishlist system and customizable order settings (size/color).
- **Order System**: Employees can submit orders; prime admins are solely responsible for approval/rejection.
- **Admin Email Requirement**: Admin and prime_admin accounts require a valid email.
- **Weekly Report Email**: Automated weekly HTML email reports for prime admins summarizing organizational activity.
- **Admin Team Management**: Admins have a dedicated "Team" tab showing employees assigned to them (via `managerId`). Admins can add/remove employees from their own team; prime admins can manage any assignment. Includes bulk credit: select team members via checkboxes, then "Give Bucks" to award bucks to all selected at once (with category and reason support). Route: `/admin/team`.
- **Custom Items**: A secondary, non-Bucks incentive token system configurable by prime admins.
- **Catalogue Maker**: Admin-defined shorthand codes for instant Bucks transactions.
- **Transaction Categories + Analytics**: Prime admins define color-coded transaction categories for analytics. Regular admins see only the categories they personally credited; budget progression and monthly budget info are hidden from regular admins (only visible to prime admins). Credits require a category selection (the category name becomes the transaction reason); debits use an optional free-text reason. Category dropdown is present across all credit UIs: instant transaction, team bulk credit, and employee detail adjust balance.
- **Monthly Reports + Documents Page**: Automated monthly JSONB reports with conversion rate, daily dollar spending chart (double line: awarded vs spent), department and category breakdowns, and an admin interface to view and generate them. PDF download uses html2canvas + jsPDF to generate real PDF files (no browser print dialog).
- **Universal Passkey**: Org-level fallback PIN for employee login.
- **Organization & Subscription**: Tiered Stripe subscriptions, organization code generation, and subscription management. Price grandfathering system: `signupPrice` column on organizations locks in the rate at signup time. Tier changes and reactivations use current market rates. Admin settings shows locked-in vs current pricing. Server-authoritative tier pricing via `/api/organizations/tier-pricing` endpoint.
- **Manager Assignment**: Prime admins can assign a manager (admin) to each employee. Manager filter available on Employees page and Dashboard. Budget panel shows employee distribution by manager with percentage breakdown. Auto-allocate distributes remaining budget proportionally based on each manager's employee count.
- **Department Management**: Prime admins manage departments and user assignments; non-prime admins are department-isolated.
- **Custom Role Labels**: Prime admins can customize display names for roles.
- **Multiple Super Users**: Organizations can have multiple prime_admin (Super User) accounts. Any Super User can promote other approved users to Super User, or demote other Super Users (as long as at least one remains). The last Super User cannot be demoted or deleted. Super Users can manage pending accounts, organization settings, and all admin functions.
- **Pending Accounts Page**: Shows accounts awaiting approval or that have never logged in, with balance, transaction count, and clickable links to full account detail pages.
- **Data Retention**: Transaction data is preserved when individual users are deleted (no FK cascade). Only full organization deletion removes transaction history.
- **Password Viewing**: Users can view their current saved password from Account Settings via a show/hide toggle. Plaintext stored in `lastPlainPassword` column, updated on every password change (profile update, admin reset, forgot-password, user creation). Hidden from developer accounts and full-service (impersonation) views. Sensitive fields (`password`, `lastPlainPassword`, `passwordResetToken`) are stripped from all user API responses via `sanitizeUser` helper and session deserialization.
- **QR Code System**: QR code-based employee identification and instant point transactions.
- **Need Help Button**: Persistent "Need Help?" button in the top header of both admin and employee layouts. Opens a dropdown with two options: (1) Restart Tutorial — resets and relaunches the onboarding tutorial, (2) Contact Us — inline contact form that opens the user's email client with a pre-filled draft to miles.chase@betterbucks.net. Also accessible from mobile hamburger menus.

### Performance & Security
- **High-Concurrency Optimizations**: Node.js clustering (up to 8 workers in production), right-sized DB pool (30 max prod / 10 dev, 4 min prod / 1 dev), in-memory user cache (120s TTL, 10k max entries) for session deserialization, bcrypt cost factor 10, session pruning every 5 minutes, `reusePort` for socket sharing, database indexes on `users.email`, `users.organization_id`, `users.organization_id+role`, `session.expire`, `transactions.user_id`.
- **Query Optimizations**: Atomic SQL increments for balance updates and login counts (no read-before-write), subquery-based IN clauses for `getCategoryStats` and `getMonthlyBudgetUsed` (single round-trip instead of two).
- **Transaction-Safe Balance Operations**: Admin credit (single and bulk) for non-prime admins uses `db.transaction` with `SELECT ... FOR UPDATE` row-level locking to prevent overspending under concurrent requests. All credit UIs (instant transaction, team bulk, employees bulk, employee detail adjust) show the admin's balance, warn on insufficient funds, and disable the submit button.
- **Demo Session Integrity**: Demo account switching uses `req.login` with `keepSessionInfo: true` to preserve session flags (`isPublicDemo`, `demoTutorialMap`, `demoTempOrgId`) across account switches. Tutorial completion is tracked per-user-ID in `session.demoTutorialMap` so switching between demo accounts maintains independent tutorial state.
- **Memory & Speed Optimizations**: Lazy-loaded server modules, minimal imports, gzip compression in all environments (level 6, 1KB threshold), vendor chunk splitting for React/TanStack/UI libs, CSS code splitting, 5-minute Cache-Control on tier pricing endpoint. Graceful DB pool shutdown on SIGTERM/SIGINT.
- **Security (OWASP-hardened)**: Bcrypt password hashing, secure session cookies, `helmet` security headers, rate limiting (600 req/min API, 30 failed logins/15min in production), Zod validation, error stripping in production, Cloudflare Turnstile CAPTCHA, PII masking in logs, and IDOR protection on order management endpoints (org ownership verified).
- **Frontend Resilience**: Global React `ErrorBoundary` component prevents white-screen crashes; all timer-based animations properly clean up on unmount.
- **SEO**: Per-page SEO with `PageSEO` component, `robots.txt`, and `sitemap.xml`.

### Blog System
- Public blog with `blogPosts` table, including routes for viewing posts.
- Developer-only CRUD for managing blog content.

### Referral Codes System
- `referral_codes` table for managing developer-managed codes that grant extra free months on signup.
- Integrated into the signup flow and lead notification emails.

### Enterprise Accounts System
- `enterprise_accounts` table for custom-priced enterprise clients with specialized billing.
- Fields: companyName, contactEmail, contactName, address, city, state, zip, customPrice (cents), billingCycle (monthly/quarterly/annual), maxLogins, contractUrl, stripeCustomerId, stripeSubscriptionId, status, notes.
- Backend: Full CRUD API routes under `/api/developer/enterprise-accounts` (list, create, cancel, upload-contract, send-test-email).
- Create flow: Creates Stripe customer + custom price + subscription with `collection_method:"send_invoice"` and `days_until_due:30`. Sends activation email to client and admin notification.
- Frontend: "Enterprise Accounts" tab in Developer Dashboard with creation form, account list table, contract upload, cancel, and test email buttons.
- Billing receipt email: Branded HTML receipt with company details, line items, tax calculation, and invoice number.

### Stripe-less Signup Flow
- When Stripe is not configured, signup triggers a lead notification email.
- Specific promo codes can bypass Stripe for immediate organization creation.

## External Dependencies

### Database
- PostgreSQL
- Drizzle ORM
- connect-pg-simple

### UI Libraries
- shadcn/ui (Radix UI)
- react-barcode
- date-fns
- Lucide React

### Authentication
- Passport.js
- passport-local
- express-session

### Development Tools
- Vite
- esbuild
- TypeScript

### Services
- Stripe (subscriptions and payments)
- Twilio (SMS phone verification)
- nodemailer (email verification)
- multer (file uploads)

## Reusable Invite Links
- Table: `invite_links` (token unique, organization_id, created_by_user_id, role_to_assign 'employee'|'admin', expires_at, is_active, signup_count).
- Routes: `POST/GET /api/invite-links`, `PATCH /api/invite-links/:id`, public `GET /api/invite-links/:token` and `POST /api/invite-links/:token/accept`.
- prime_admin can create links granting Manager (admin) or Employee role; admin (manager) can create employee-only links and may only modify links they created.
- Public URL form: `/join/<64-hex-token>` — `client/src/pages/join.tsx` sniffs the param and dispatches to `JoinLinkPage` for these tokens; otherwise falls back to existing site-id flow.
- Admin UI: `/admin/invite-links` (`client/src/pages/admin-invite-links.tsx`).