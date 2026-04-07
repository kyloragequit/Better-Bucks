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
- **Surveys System**: Admins can create multi-question surveys for employees and view results.
- **Employee Store**: Admins curate items for employees to purchase with Bucks, including a wishlist system and customizable order settings (size/color).
- **Order System**: Employees can submit orders; prime admins are solely responsible for approval/rejection.
- **Admin Email Requirement**: Admin and prime_admin accounts require a valid email.
- **Weekly Report Email**: Automated weekly HTML email reports for prime admins summarizing organizational activity.
- **Custom Items**: A secondary, non-Bucks incentive token system configurable by prime admins.
- **Catalogue Maker**: Admin-defined shorthand codes for instant Bucks transactions.
- **Transaction Categories + Analytics**: Prime admins define color-coded transaction categories for analytics.
- **Monthly Reports + Documents Page**: Automated monthly JSONB reports with conversion rate, daily dollar spending chart (double line: awarded vs spent), department and category breakdowns, and an admin interface to view and generate them.
- **Universal Passkey**: Org-level fallback PIN for employee login.
- **Organization & Subscription**: Tiered Stripe subscriptions, organization code generation, and subscription management.
- **Department Management**: Prime admins manage departments and user assignments; non-prime admins are department-isolated.
- **Custom Role Labels**: Prime admins can customize display names for roles.
- **Super User Transfer**: The prime_admin (Super User) can transfer their role to another approved org user via an atomic DB transaction. Only the Super User can cancel pending accounts and manage settings.
- **Pending Accounts Page**: Shows accounts awaiting approval or that have never logged in, with balance, transaction count, and clickable links to full account detail pages.
- **Data Retention**: Transaction data is preserved when individual users are deleted (no FK cascade). Only full organization deletion removes transaction history.
- **Password Viewing**: Users can view their current saved password from Account Settings via a show/hide toggle. Plaintext stored in `lastPlainPassword` column, updated on every password change (profile update, admin reset, forgot-password, user creation). Hidden from developer accounts and full-service (impersonation) views. Sensitive fields (`password`, `lastPlainPassword`, `passwordResetToken`) are stripped from all user API responses via `sanitizeUser` helper and session deserialization.
- **QR Code System**: QR code-based employee identification and instant point transactions.

### Performance & Security
- **Memory Optimizations**: Lazy-loaded server modules, minimal imports, limited DB connection pool.
- **Security (OWASP-hardened)**: Bcrypt password hashing, secure session cookies, `helmet` security headers, rate limiting, Zod validation, error stripping in production, Cloudflare Turnstile CAPTCHA, and PII masking in logs.
- **SEO**: Per-page SEO with `PageSEO` component, `robots.txt`, and `sitemap.xml`.

### Blog System
- Public blog with `blogPosts` table, including routes for viewing posts.
- Developer-only CRUD for managing blog content.

### Referral Codes System
- `referral_codes` table for managing developer-managed codes that grant extra free months on signup.
- Integrated into the signup flow and lead notification emails.

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