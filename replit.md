# Employee Incentive Portal

## Overview

This is a multi-tenant full-stack employee incentive and rewards management system. Organizations sign up via a $50/month Stripe subscription, receive an organization code, and set up their prime admin account. Employees can view their point balances and transaction history via barcode-based identification, while administrators can manage employee accounts, adjust balances, and approve new admin registrations. The system features a role-based access control hierarchy with employees, admins, and a prime admin who can approve new administrator accounts.

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
  - `organizations` - Multi-tenant org accounts with code, Stripe customer/subscription IDs, status
  - `users` - Employee/admin accounts with role, status, balance, barcode, email (optional), organizationId
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
- **Note**: Current implementation uses plain text password comparison (marked as insecure for demo purposes)

### Order System
- Employees can browse items at https://dscpromostore.com/ and submit orders with photo screenshots
- Orders deduct points from employee balance on creation
- Admins can approve, reject, or complete orders
- Rejected orders refund points back to the employee
- Only employees can create orders (role-restricted)

### Organization & Subscription System
- Landing page (/) with "Sign up for your organization" and "Log in to my organization" options
- Signup flow: Enter org name + email -> Stripe checkout ($50/month) -> receive org code
- First-time login: Enter org code -> create prime admin account
- Stripe integration via stripe-replit-sync for webhook processing and data sync
- Stripe client: server/stripeClient.ts, webhook handler: server/webhookHandlers.ts
- Webhook route registered BEFORE express.json() middleware in server/index.ts
- PRIME1 organization: Free membership org (stripeCustomerId="free_membership"), auto-created on startup
- Prime admins can cancel their org subscription via Settings page (/admin/settings)
- Free memberships cannot be cancelled

### App Branding
- Yellow square logo with letter "B" used across all layouts (AppLogo component)
- DHL brand color palette (golden yellow primary, crimson red secondary)

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