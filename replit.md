# Better Bucks

## Overview

Better Bucks is a multi-tenant, full-stack employee incentive and rewards management system. It enables organizations to manage employee rewards, point balances, and transactions, supporting a tiered subscription model via Stripe. Employees can track their points and interact with an internal store or submit orders, while administrators handle user management, balance adjustments, and order approvals. The system features a robust role-based access control (RBAC) hierarchy, including prime administrators who oversee the entire organization.

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
- **Schema**:
    - `organizations`: Multi-tenant orgs with Stripe integration, employee limits.
    - `users`: Employees/admins with roles, balances, barcode, department.
    - `departments`: Organizational departments.
    - `transactions`: Point credit/debit history.
    - `orders`: Employee store orders with status and photos.
    - `store_items`: Items available for purchase in the employee store.
    - `wishlists`: Employee wishlists for store items.
    - `blogPosts`: Public blog articles with HTML content, author info, and sources.
    - `goals`: Team goals set by prime admins (time-based or quantity-based) with Bucks rewards.
    - `goalNotifications`: Per-user notifications for goal outcomes (distributed/failed), shown as a login modal.
    - `referralCodes`: Developer-managed codes used on signup to grant extra free months; included in lead notification emails.
- **File Uploads**: Multer-based to local storage.
- **Migrations**: Drizzle-kit.

### Authentication & Authorization
- Session-based, expires on browser close (no maxAge).
- **Roles**: `employee`, `admin`, `prime_admin`. Admin accounts require prime admin approval.
- **Verification**: Email or Phone verification (Twilio SMS) for new users, with uniqueness enforced per organization.
- **Feature Flags**: Prime admins can enable/disable the employee store and manual order requests.
- **Passkeys (WebAuthn)**: Users can register passkeys (Windows Hello, Face ID, etc.) via `@simplewebauthn/server` + `@simplewebauthn/browser`. Passkeys stored in `passkeys` table. Login page has "Sign in with Passkey" button on both employee and admin forms. Settings pages expose `PasskeyManager` for add/rename/delete. `PasskeyFirstTimePrompt` shown on dashboards when user has no passkeys registered (dismissed via sessionStorage).

### Key Features
- **Goals System**: Prime admins create time-based ("days without an incident") or quantity-based goals with a Bucks reward. Progress bars appear on every employee dashboard. When complete, prime admins distribute Bucks to all approved employees. Employees see a login notification modal when a goal is met (after distribution) or failed.
- **Surveys System**: Admins create multi-question surveys (multiple choice + written answer). Active surveys appear in the employee "Surveys" tab. Admins view results/analytics per question with option-level response counts. Tables: `surveys`, `survey_questions`, `survey_responses`, `survey_answers`. Routes: `GET/POST /api/surveys`, `GET /api/surveys/:id/respond`, `POST /api/admin/surveys`, `PATCH /api/admin/surveys/:id/status`, `DELETE /api/admin/surveys/:id`, `GET /api/admin/surveys/:id/results`. Demo org has a pre-seeded active survey. Landing page features surveys in the feature strip.
- **Employee Store**: Admins curate items for employees to purchase with Bucks. Includes an employee wishlist system.
- **Order System**: Employees can submit orders from external URLs with photo proof; admins approve/reject.
- **Organization & Subscription**: Tiered Stripe subscriptions, organization code generation, prime admin setup, and subscription management (upgrade/downgrade, cancellation).
- **Department Management**: Prime admins create and manage departments, assigning users. Non-prime admins are department-isolated.
- **Custom Role Labels**: Prime admins can customize display names for "Admin" and "Employee" roles.
- **QR Code System**: QR code-based employee identification and instant point transactions via scanning.

### Performance & Security
- **Memory Optimizations**: Lazy-loaded server modules, minimal startup imports, limited DB connection pool, removed unused UI components.
- **Security (OWASP-hardened)**:
  - All passwords hashed with bcrypt (12 rounds); transparent migration on first login for existing plaintext passwords
  - Session cookies: `httpOnly`, `secure` (prod), `sameSite: "lax"`, 7-day expiry; startup guard refuses boot without `SESSION_SECRET` in production
  - `helmet` security headers (X-Frame-Options, X-Content-Type-Options, Referrer-Policy, HSTS, etc.)
  - Rate limiting: 10 login attempts / 15 min per IP; 300 API requests / min per IP
  - Request body size capped at 50kb to prevent oversized payload attacks
  - Zod validation on all API routes
  - Error handler strips internal details from 500 responses in production
  - CAPTCHA (HMAC-SHA256 signed math challenge) every 5th successful login
  - `trust proxy` set so rate limiters use real client IP behind Replit's reverse proxy
- **SEO**: Per-page SEO with `PageSEO` component, `robots.txt`, and `sitemap.xml`.

### Blog System
- `blogPosts` table: id, title, slug (unique), excerpt, content (HTML), imageUrl, authorName, authorPhotoUrl, sources (JSON), publishedAt, createdAt
- Public routes: `GET /api/blog`, `GET /api/blog/:slug`
- Developer-only CRUD: `POST/PATCH/DELETE /api/developer/blog/:id`
- Frontend: `/blog` (post grid with square image cards), `/blog/:slug` (full post with prose styling + sources)
- Blog link in landing page header; Blog tab in developer dashboard with inline create/edit form

### Referral Codes System
- `referral_codes` table: id, code (uppercase, unique), description, extra_months (default 1), active, created_at
- Managed exclusively in the developer dashboard under the "Referral Codes" tab (no redeployment needed)
- Developer-only API: `GET/POST /api/developer/referral-codes`, `PATCH/DELETE /api/developer/referral-codes/:id`
- Signup page has a "Referral Code (optional)" field with "+1 month free" badge and promotional hint text
- On signup submission: code is validated against DB; if valid and active, the lead notification email to miles.chase@betterbucks.net includes a highlighted green referral row
- Response includes `referralValid: true` and `referralExtraMonths` so the confirmation screen shows "+N free months applied!"

### Stripe-less Signup Flow
- When Stripe connector is not configured (production), signup sends a lead notification email to miles.chase@betterbucks.net and returns `{ contactPending: true }`
- Email includes company, contact email, plan tier (labeled "FOUNDER PRICING"), monthly rate, employee limit, referral code info (if any), and submission timestamp
- GOKU11 promo code bypasses Stripe entirely and creates/activates an org immediately

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
- Stripe (for subscriptions and payments)
- Twilio (for SMS phone verification)
- nodemailer (for email verification)
- multer (for file uploads)