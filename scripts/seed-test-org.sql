-- ─────────────────────────────────────────────────────────────────────────────
-- Better Bucks — Test Organization Seed
--
-- Creates (or re-activates) a throwaway org "TESTCO" plus a prime-admin owner and
-- one employee, for testing the payment/billing and store flows.
--
-- Passwords are stored in plain text on purpose: the app's verifyPassword() accepts
-- a plain-text fallback for any value that isn't a bcrypt hash, so these log in fine.
-- This is a TEST org only — do not use this pattern for real accounts.
--
-- Run from the Replit Shell:
--     psql "$DATABASE_URL" -f scripts/seed-test-org.sql
--
-- Login afterward:
--     Owner    → username: 123456         password: 123456
--     Employee → username: test_employee  password: employee123
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. The organization (idempotent on the unique code).
INSERT INTO organizations
  (name, code, status, tier, max_employees, bucks_per_dollar,
   monthly_budget_bucks, plan_bucks, org_bucks_balance,
   store_enabled, orders_enabled, manual_orders_enabled)
VALUES
  ('Test Company', 'TESTCO', 'active', 'starter', 50, 100,
   50000, 500, 0,
   true, true, true)
ON CONFLICT (code) DO UPDATE SET status = 'active';

-- 2. The prime-admin owner (idempotent on the unique username).
INSERT INTO users
  (username, password, full_name, role, barcode, organization_id, balance, status)
VALUES
  ('123456', '123456', 'Test Owner', 'prime_admin', '123456',
   (SELECT id FROM organizations WHERE code = 'TESTCO'), 0, 'approved')
ON CONFLICT (username) DO UPDATE SET
  password        = '123456',
  role            = 'prime_admin',
  organization_id = (SELECT id FROM organizations WHERE code = 'TESTCO'),
  status          = 'approved';

-- 3. A test employee to receive Bucks and place orders.
INSERT INTO users
  (username, password, full_name, role, barcode, organization_id, balance, status)
VALUES
  ('test_employee', 'employee123', 'Test Employee', 'employee', 'test_employee',
   (SELECT id FROM organizations WHERE code = 'TESTCO'), 0, 'approved')
ON CONFLICT (username) DO UPDATE SET
  organization_id = (SELECT id FROM organizations WHERE code = 'TESTCO');

-- Show the result.
SELECT o.id AS org_id, o.name, o.code, o.plan_bucks,
       u.username, u.role
FROM organizations o
JOIN users u ON u.organization_id = o.id
WHERE o.code = 'TESTCO'
ORDER BY u.role;
