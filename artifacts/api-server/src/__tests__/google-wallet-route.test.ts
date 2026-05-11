import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import crypto from "crypto";
import type { User } from "@workspace/db";

// ── Module mocks (hoisted) ───────────────────────────────────────────────────

vi.mock("pino", () => ({
  default: vi.fn(() => ({
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    child: vi.fn(),
  })),
}));

vi.mock("../lib/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    child: vi.fn(),
  },
}));

vi.mock("../stripeOrphanRetry", () => ({
  recordStripeOrphan: vi.fn().mockResolvedValue(undefined),
  startStripeOrphanRetryJob: vi.fn(),
}));

vi.mock("../stripeLazy", () => ({
  ensureStripeReady: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../auth", () => ({
  hashPassword: vi.fn().mockResolvedValue("hashed-pw"),
  verifyPassword: vi.fn().mockResolvedValue(true),
}));

vi.mock("../socialAuth", () => ({
  verifyAppleIdentityToken: vi.fn(),
  verifyGoogleIdToken: vi.fn(),
}));

vi.mock("../lib/lockoutNotify", () => ({
  notifyAdminsOfAccountLockout: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../lib/alerts", () => ({
  sendGhostStripeAlert: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../walletPass", () => ({
  buildPassForEmployee: vi.fn(),
  pushPassUpdateForEmployee: vi.fn(),
  PassConfigError: class PassConfigError extends Error {},
}));

vi.mock("../googleWalletPass", () => ({
  buildGoogleWalletSaveUrl: vi.fn(),
  GoogleWalletConfigError: class GoogleWalletConfigError extends Error {},
}));

vi.mock("../storage", () => ({
  storage: {
    getUser: vi.fn(),
    getUserByUsername: vi.fn().mockResolvedValue(undefined),
    getUserByEmailGlobal: vi.fn().mockResolvedValue(undefined),
    createMobileSignup: vi.fn(),
    updateUserPassword: vi.fn().mockResolvedValue(undefined),
    updateUserProfile: vi.fn().mockResolvedValue(undefined),
    getSocialLinkByProvider: vi.fn().mockResolvedValue(undefined),
    updateUserPushToken: vi.fn().mockResolvedValue(undefined),
    recordFailedLogin: vi.fn().mockResolvedValue({ user: null, justLocked: false }),
    recordSuccessfulLogin: vi.fn().mockResolvedValue(null),
    getUserSocialLinks: vi.fn().mockResolvedValue([]),
    createSocialLink: vi.fn().mockResolvedValue(undefined),
    getSurveysByOrganization: vi.fn().mockResolvedValue([]),
    getSurvey: vi.fn().mockResolvedValue(undefined),
    hasSurveyResponse: vi.fn().mockResolvedValue(false),
    submitSurveyResponse: vi.fn().mockResolvedValue(undefined),
    getGoal: vi.fn().mockResolvedValue(undefined),
    incrementGoalQuantity: vi.fn().mockResolvedValue(undefined),
    getGoalsByOrganization: vi.fn().mockResolvedValue([]),
    getUsersByOrganization: vi.fn().mockResolvedValue([]),
    getStoreItems: vi.fn().mockResolvedValue([]),
    getTransactionsByUser: vi.fn().mockResolvedValue([]),
    getOrdersByUser: vi.fn().mockResolvedValue([]),
    getWishlists: vi.fn().mockResolvedValue([]),
    createOrder: vi.fn().mockResolvedValue(undefined),
    updateUserBalance: vi.fn().mockResolvedValue(undefined),
    tryDeductBalance: vi.fn().mockResolvedValue(undefined),
    createTransaction: vi.fn().mockResolvedValue(undefined),
    getWalletPassByUserId: vi.fn().mockResolvedValue(undefined),
    upsertWalletPass: vi.fn().mockResolvedValue(undefined),
    upsertWalletPassDevice: vi.fn().mockResolvedValue(undefined),
    getWalletPassDevice: vi.fn().mockResolvedValue(undefined),
    deleteWalletPassDevice: vi.fn().mockResolvedValue(undefined),
    getWalletPassDevices: vi.fn().mockResolvedValue([]),
    getOrganization: vi.fn().mockResolvedValue(undefined),
    getOrdersByOrganization: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("../stripeClient", () => ({
  getUncachableStripeClient: vi.fn(),
}));

// ── Imports (after mocks) ────────────────────────────────────────────────────

import { storage } from "../storage";
import { buildGoogleWalletSaveUrl, GoogleWalletConfigError } from "../googleWalletPass";
import { registerMobileRoutes } from "../routes/mobile";

// ── Typed fixtures ────────────────────────────────────────────────────────────

const EMPLOYEE_USER: User = {
  id: 7,
  username: "emp_test",
  password: "hashed-password",
  role: "employee",
  status: "approved",
  balance: 100,
  barcode: "BB-EMP-7",
  fullName: "Test Employee",
  mustChangePassword: false,
  passwordLastChanged: null,
  email: "emp@example.com",
  phone: null,
  emailVerified: true,
  emailVerificationCode: null,
  passwordResetToken: null,
  passwordResetExpiry: null,
  organizationId: 1,
  departmentId: null,
  termsAcceptedAt: null,
  marketingOptIn: false,
  successfulLoginCount: 0,
  tutorialCompleted: false,
  twoFaPromptDismissed: false,
  customItemBalance: 0,
  lastPlainPassword: null,
  managerId: null,
  failedLoginAttempts: 0,
  lockedUntil: null,
  expoPushToken: null,
};

// ── Helpers ──────────────────────────────────────────────────────────────────

const SESSION_SECRET = "test-secret-at-least-16-chars!!";

function signMobileToken(userId: number): string {
  const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
  const exp = Date.now() + TOKEN_TTL_MS;
  const payload = `${userId}.${exp}`;
  const sig = crypto
    .createHmac("sha256", SESSION_SECRET)
    .update(payload)
    .digest("base64url");
  return `${Buffer.from(payload).toString("base64url")}.${sig}`;
}

function buildApp() {
  const app = express();
  app.use(express.json());
  registerMobileRoutes(app);
  return app;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("GET /api/mobile/wallet-pass/android — 503 when Google Wallet not configured", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();

    vi.stubEnv("SESSION_SECRET", SESSION_SECRET);

    vi.mocked(storage.getUser).mockResolvedValue(EMPLOYEE_USER);

    vi.mocked(buildGoogleWalletSaveUrl).mockRejectedValue(
      new GoogleWalletConfigError(
        "Google Wallet is not configured. Missing secret(s): GOOGLE_WALLET_ISSUER_ID, GOOGLE_WALLET_CLASS_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY. Ask your administrator to add them in Replit Secrets.",
      ),
    );
  });

  it("returns HTTP 503", async () => {
    const token = signMobileToken(EMPLOYEE_USER.id);
    const res = await request(buildApp())
      .get("/api/mobile/wallet-pass/android")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(503);
  });

  it("response body has a message field", async () => {
    const token = signMobileToken(EMPLOYEE_USER.id);
    const res = await request(buildApp())
      .get("/api/mobile/wallet-pass/android")
      .set("Authorization", `Bearer ${token}`);

    expect(res.body).toHaveProperty("message");
    expect(typeof res.body.message).toBe("string");
    expect(res.body.message.length).toBeGreaterThan(0);
  });

  it("message mentions missing configuration", async () => {
    const token = signMobileToken(EMPLOYEE_USER.id);
    const res = await request(buildApp())
      .get("/api/mobile/wallet-pass/android")
      .set("Authorization", `Bearer ${token}`);

    expect(res.body.message).toMatch(/not configured|missing/i);
  });

  it("returns 401 when no auth token is provided", async () => {
    const res = await request(buildApp()).get(
      "/api/mobile/wallet-pass/android",
    );
    expect(res.status).toBe(401);
  });
});
