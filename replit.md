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
- **File Uploads**: Multer-based to local storage.
- **Migrations**: Drizzle-kit.

### Authentication & Authorization
- Session-based with 30-day cookie expiry.
- **Roles**: `employee`, `admin`, `prime_admin`. Admin accounts require prime admin approval.
- **Verification**: Email or Phone verification (Twilio SMS) for new users, with uniqueness enforced per organization.
- **Feature Flags**: Prime admins can enable/disable the employee store and manual order requests.

### Key Features
- **Employee Store**: Admins curate items for employees to purchase with Bucks. Includes an employee wishlist system.
- **Order System**: Employees can submit orders from external URLs with photo proof; admins approve/reject.
- **Organization & Subscription**: Tiered Stripe subscriptions, organization code generation, prime admin setup, and subscription management (upgrade/downgrade, cancellation).
- **Department Management**: Prime admins create and manage departments, assigning users. Non-prime admins are department-isolated.
- **Custom Role Labels**: Prime admins can customize display names for "Admin" and "Employee" roles.
- **QR Code System**: QR code-based employee identification and instant point transactions via scanning.

### Performance & Security
- **Memory Optimizations**: Lazy-loaded server modules, minimal startup imports, limited DB connection pool, removed unused UI components.
- **Security**: Session-based auth, email/phone verification, password change enforcement.
- **SEO**: Per-page SEO with `PageSEO` component, `robots.txt`, and `sitemap.xml`.

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