# Better Bucks

## Overview

This is a multi-tenant full-stack employee incentive and rewards management system branded as "Better Bucks". Organizations sign up via tiered Stripe subscriptions, receive an organization code, and set up their prime admin account. Employees can view their point balances and transaction history via QR code-based identification, while administrators can manage employee accounts, adjust balances, and approve new admin registrations. The system features a role-based access control hierarchy with employees, admins, and a prime admin who can approve new administrator accounts.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight React router)
- **State Management**: TanStack React Query for server state
- **Styling**: Tailwind CSS with shadcn/ui component library (New York style)
- **Build Tool**: Vite with path aliases (@/ for client/src, @shared for shared)

The frontend follows a page-based architecture with role-specific layouts:
- `EmployeeLayout` - For employee dashboard views
- `AdminLayout` - For admin portal views

Authentication state is managed via React Query with session-based auth cookies.

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **Authentication**: Passport.js with Local Strategy and session-based auth
- **Session Storage**: PostgreSQL via connect-pg-simple
- **API Design**: RESTful endpoints defined in shared/routes.ts with Zod validation

The backend uses a storage abstraction layer (`IStorage` interface) implemented by `DatabaseStorage` class, allowing for potential swapping of data stores.

### Data Storage
- **Database**: PostgreSQL with Drizzle ORM
- **Schema Location**: shared/schema.ts
- **Tables**:
  - `organizations` - Multi-tenant org accounts with code, Stripe customer/subscription IDs, status, adminRoleLabel, employeeRoleLabel
  - `users` - Employee/admin accounts with role, status, balance, barcode, email (optional), organizationId, departmentId
  - `departments` - Organization departments with name and organizationId
  - `transactions` - Point credits/debits with reason and timestamp
    - When admins credit points to employees, a corresponding debit transaction is created on the admin's account with reason "Points given to {employee name}"
  - `orders` - Employee orders with photo URLs, points cost, status (pending/approved/rejected/completed), admin notes
- **Stripe Schema**: Managed by stripe-replit-sync (stripe.products, stripe.prices, stripe.customers, etc.)
- **File Uploads**: Multer-based file upload to `uploads/` directory, served at `/uploads/` path (auth-protected)
- **Migrations**: Managed via drizzle-kit with `db:push` command

### Authentication & Authorization
- Session-based authentication with 30-day cookie expiry
- Three user roles: `employee`, `admin`, `prime_admin`
- Admin accounts require approval from prime_admin before activation
- Password change enforcement via `mustChangePassword` flag
- Email verification required for all new users (6-digit code sent via email)
  - Users with email set but not verified are redirected to /verify-email
  - Existing users without email are not blocked
  - Email must be unique within an organization
  - SMTP configured via SMTP_USER and SMTP_PASS secrets (falls back to console logging)
  - Endpoints: POST /api/verify-email, POST /api/resend-verification
- **Note**: Current implementation uses plain text password comparison (marked as insecure for demo purposes)

### Verification System (Email or Phone)
- All user creation forms offer a toggle between Email and Phone verification
- At least one contact method (email or phone) is required for new accounts
- Phone verification via Twilio SMS API (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER)
- Both email and SMS fall back to console logging when credentials aren't configured
- Phone uniqueness enforced within organization boundaries (same as email)
- Verify page (/verify-email) dynamically shows Email or Phone UI based on user's contact method
- `emailVerified` field is reused for both email and phone verification status
- getUserByPhoneAndOrg storage method for phone uniqueness checks

### Employee Store (Internal Shop)
- Admins can create a curated store of items employees can browse and purchase with Bucks
- Store items have: name, price (in Bucks), item URL, and a preview image (uploadable or URL)
- Employees browse items at `/store` in a scrollable image grid
- Clicking an item image opens the item's URL in a new tab
- "Purchase" button opens a confirmation dialog: "Purchase for X Bucks?"
- If employee has insufficient balance: dialog shows "You do not have enough Bucks for this"
- Successful purchase deducts Bucks from balance, creates a transaction record, and submits an order for admin approval
- Purchase orders appear in admin orders with description "Store Purchase: [Item Name]", photo preview, item link, and bucks-to-dollar conversion value
- Store purchase orders auto-compute a `convertedValue` using the org's first shop website with a valid `pointsPerDollar` rate
- Admin store management page: `/admin/store` (prime_admin only nav tab) with CRUD for items
- Table: `store_items` (id, organizationId, name, price, url, imageUrl, createdAt)
- API routes: GET/POST /api/store-items, PATCH/DELETE /api/store-items/:id, POST /api/store-items/:id/purchase

### Wishlist System
- Employees can "heart" any store item to save it to their wishlist (no Bucks deducted)
- Heart button overlays each store item in the grid; toggling adds/removes from wishlist
- Wishlist section appears on employee dashboard when items are saved
- Admins can view all employee wishlists from the admin Store page (grouped by item with employee name tags)
- Table: `wishlists` (id, userId, storeItemId, createdAt)
- API routes: GET /api/wishlist, POST /api/wishlist/:itemId, DELETE /api/wishlist/:itemId, GET /api/admin/wishlists

### Employee Feature Flags
- Prime admins can disable the employee store and/or manual order requests from the Settings page
- "Employee Features" card in admin settings has toggle switches for each feature
- When store is disabled: Store nav tab disappears for employees
- When manual orders disabled: New Order button replaced with "currently disabled" message on the orders page
- Feature flags stored as `storeEnabled` (boolean, default true) and `manualOrdersEnabled` (boolean, default true) on organizations table
- API routes: GET /api/organizations/features (any auth), PATCH /api/organizations/feature-flags (prime_admin only)

### Order System
- Employees browse items at a configurable store URL and submit orders with photo screenshots
- Store URL is set during initial org setup (no default); prime admins can also edit it from Settings page
- Employees see the store URL in their nav and orders page
- Orders support both item links (URLs) and photo uploads - at least one is required
- Orders have `itemUrl` column (optional text) and `photoUrls` array
- Orders deduct points from employee balance on creation
- Admins can approve, reject, or complete orders
- Rejected orders refund points back to the employee
- Only employees can create orders (role-restricted)

### Organization & Subscription System
- Landing page (/) with "Sign up for your organization" and "Log in to my organization" options
- Signup flow: Select tier -> Enter org name + email + optional promo code -> Stripe checkout -> receive org code
- Promo code GOKU11 bypasses payment and activates org immediately
- First-time setup requires selecting a store website URL (no default)
- **Pricing Tiers**:
  - Small Site: $49.99/month, up to 100 employees
  - Mid-Size Site: $99.99/month, up to 300 employees
  - Large Site: $149.99/month, up to 500 employees
  - Enterprise: $299.99/month, unlimited employees
- Organizations have `tier` and `maxEmployees` columns; employee limits enforced on user creation
- First-time login: Enter org code -> create prime admin account
- Stripe integration via stripe-replit-sync for webhook processing and data sync
- Stripe client: server/stripeClient.ts, webhook handler: server/webhookHandlers.ts
- Webhook route registered BEFORE express.json() middleware in server/index.ts
- PRIME1 organization: Free membership org (stripeCustomerId="free_membership", tier="enterprise"), auto-created on startup
- Prime admins can cancel their org subscription via Settings page (/admin/settings)
- Admin Dashboard page (/admin/dashboard) shows bucks distributed from admins to employees (week/month/year) with filter-by-administrator dropdown
- Transactions track `performedBy` to identify which admin performed the action
- Settings page shows current tier, employee count/limit with usage bar
- Prime admins can change their subscription tier (upgrade/downgrade) via Settings page
- Tier changes update Stripe subscription with proration and update local DB tier/maxEmployees
- Free memberships cannot be cancelled or changed
- 60-day free trial on all tiers via Stripe subscription_data: { trial_period_days: 60 }
- Signup QR code: Prime admins see a QR code on Settings page that links to `/login?orgCode=XXX&tab=employee&mode=create`
- Login page accepts URL params: `orgCode`, `tab` (employee/admin), `mode` (create) to pre-fill registration
- Payment pause system: Organizations with lapsed payments get status "paused"
  - `GET /api/organizations/my-status` checks Stripe subscription status and auto-pauses if past_due/unpaid
  - PaymentPausedDialog component shown in both admin and employee layouts when org is paused/inactive
  - Prime admins get "Update Billing" button (opens Stripe billing portal); other users see "contact admin" message
  - `POST /api/organizations/billing-portal` creates a Stripe billing portal session for the prime admin
  - Organization status enum: active, inactive, pending, paused

### Department Management
- Prime admins can create, edit, and delete departments in Settings page
- Prime admins can assign any user (admin or employee) to departments from the Employees page
- Prime admins see all users across all departments with department filter
- Non-prime admins are isolated to their own department — they can only see and interact with users in the same department
- Department filter on Employees page for easy filtering by department (prime admin only)
- API endpoints: GET/POST /api/departments, PATCH/DELETE /api/departments/:id, PATCH /api/users/:id/department

### Custom Role Labels
- Prime admins can customize "Admin" and "Employee" role display names (e.g., "Group Lead", "Team Member")
- Custom role labels stored in organizations table (adminRoleLabel, employeeRoleLabel)
- Labels displayed throughout the admin portal using useRoleLabels hook
- API endpoints: GET/PUT /api/organizations/role-labels

### QR Code System
- Employee dashboard shows QR code instead of barcode for identification
- QR codes encode user ID, username, and barcode data as JSON
- Uses qrcode.react library for generation and html5-qrcode for scanning
- QR codes displayed in navy blue (#162A4A) brand color

### Instant Transaction
- Admins can credit/debit points via QR code scan or manual lookup
- Camera-based QR scanner using html5-qrcode library
- Manual lookup by username or employee code
- Transaction screen shows employee details and allows credit/debit with reason
- Accessible at /admin/instant-transaction
- API endpoint: GET /api/users/scan/:identifier for employee lookup

### Document Management System
- Documents feature removed from UI (tabs/routes removed, placeholder pages deleted)
- Backend API endpoints still exist but are not linked from the UI
- Documents table schema retained in database

### Memory Optimizations
- **Lazy-loaded server modules**: Stripe SDK, nodemailer, multer, compression, serveStatic all loaded on-demand
- **Minimal startup imports**: server/index.ts only imports express, routes, and http at startup
- **Response logging**: Logs method/path/status/duration only (no JSON body capture to prevent memory leaks)
- **SIGHUP handler**: Prevents workflow runner from killing the server via default signal behavior
- **process.exit(1) override**: Prevents Vite/esbuild transient crashes from killing the dev server
- **Unused UI components removed**: aspect-ratio, calendar, collapsible, context-menu, drawer, hover-card, menubar, pagination, radio-group, sidebar, slider
- **Unused hooks removed**: use-mobile
- **All pages lazy-loaded**: Every page uses React.lazy() with dynamic imports in App.tsx
- **DB pool limited**: max 5 connections to reduce memory overhead

### App Branding
- Custom logo image used across all layouts (AppLogo component imports from @assets)
- Navy blue and green brand color palette (primary #162A4A, secondary #4E9F3D)

### Shared Code
The `shared/` directory contains code used by both frontend and backend:
- `schema.ts` - Drizzle table definitions and Zod insert schemas
- `routes.ts` - API route definitions with input/output Zod schemas

## External Dependencies

### Database
- PostgreSQL (required, connection via DATABASE_URL environment variable)
- Drizzle ORM for database operations
- connect-pg-simple for session storage

### UI Libraries
- shadcn/ui components (Radix UI primitives)
- react-barcode for employee barcode generation
- date-fns for date formatting
- Lucide React for icons
- multer for file uploads (server-side)

### Authentication
- Passport.js with passport-local strategy
- express-session for session management

### Development
- Vite for frontend development and building
- esbuild for server bundling
- TypeScript for type safety

## SEO
- Per-page SEO implemented via custom `PageSEO` component (`client/src/components/page-seo.tsx`)
- Uses `useEffect` + native DOM APIs to set `document.title`, meta description, Open Graph, Twitter Card, and canonical tags on each navigation
- JSON-LD Organization schema injected on the landing page (`/`)
- `client/public/robots.txt` — blocks crawlers from `/admin`, `/dashboard`, `/api`, and other authenticated routes
- `client/public/sitemap.xml` — lists all public indexable pages with priority and changefreq
- Google Fonts trimmed to only the two fonts in use: Outfit (headings) + Inter (body)
- Update `SITE_URL` in `page-seo.tsx` and `sitemap.xml` when a custom domain is configured