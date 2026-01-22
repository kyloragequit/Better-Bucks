# Employee Incentive Portal

## Overview

This is a full-stack employee incentive and rewards management system. Employees can view their point balances and transaction history via barcode-based identification, while administrators can manage employee accounts, adjust balances, and approve new admin registrations. The system features a role-based access control hierarchy with employees, admins, and a prime admin who can approve new administrator accounts.

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
  - `users` - Employee/admin accounts with role, status, balance, barcode
  - `transactions` - Point credits/debits with reason and timestamp
- **Migrations**: Managed via drizzle-kit with `db:push` command

### Authentication & Authorization
- Session-based authentication with 30-day cookie expiry
- Three user roles: `employee`, `admin`, `prime_admin`
- Admin accounts require approval from prime_admin before activation
- Password change enforcement via `mustChangePassword` flag
- **Note**: Current implementation uses plain text password comparison (marked as insecure for demo purposes)

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

### Authentication
- Passport.js with passport-local strategy
- express-session for session management

### Development
- Vite for frontend development and building
- esbuild for server bundling
- TypeScript for type safety