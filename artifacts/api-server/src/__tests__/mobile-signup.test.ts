import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import type Stripe from "stripe";
import type { User } from "@workspace/db";

// ── Module mocks ──────────────────────────────────────────────────────────────
// Must be declared before any imports that transitively pull in these modules.

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

vi.mock("../walletPass", () => ({
  buildPassForEmployee: vi.fn(),
  PassConfigError: class PassConfigError extends Error {},
}));

vi.mock("../googleWalletPass", () => ({
  buildGoogleWalletSaveUrl: vi.fn(),
  GoogleWalletConfigError: class GoogleWalletConfigError extends Error {},
}));

vi.mock("../storage", () => ({
  storage: {
    getUserByUsername: vi.fn().mockResolvedValue(undefined),
    getUserByEmailGlobal: vi.fn().mockResolvedValue(undefined),
    createMobileSignup: vi.fn(),
    getUser: vi.fn().mockResolvedValue(undefined),
    updateUserPassword: vi.fn().mockResolvedValue(undefined),
    updateUserProfile: vi.fn().mockResolvedValue(undefined),
    getSocialLinkByProvider: vi.fn().mockResolvedValue(undefined),
    updateUserPushToken: vi.fn().mockResolvedValue(undefined),
    recordFailedLogin: vi
      .fn()
      .mockResolvedValue({ user: null, justLocked: false }),
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
  },
}));

vi.mock("../stripeClient", () => ({
  getUncachableStripeClient: vi.fn(),
}));

// ── Imports (after mocks) ────────────────────────────────────────────────────

import { storage } from "../storage";
import { getUncachableStripeClient } from "../stripeClient";
import * as alertsModule from "../lib/alerts";
import { registerMobileRoutes } from "../routes/mobile";

// ── Constants ────────────────────────────────────────────────────────────────

const STRIPE_CUSTOMER_ID = "cus_GHOST_TEST_999";
const STRIPE_SUB_ID = "sub_GHOST_TEST_999";

const VALID_BODY = {
  organizationName: "Acme Corp",
  fullName: "Jane Doe",
  email: "jane@acme.com",
  password: "password123",
  tier: "small",
  paymentMethodId: "pm_test_card_123",
  licenseAccepted: true,
  hcaptchaToken: "test-bypass-token",
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildApp() {
  const app = express();
  app.use(express.json());
  registerMobileRoutes(app);
  return app;
}

function makeStripe(overrides: { delThrows?: boolean } = {}) {
  return {
    customers: {
      create: vi.fn().mockResolvedValue({ id: STRIPE_CUSTOMER_ID }),
      del: overrides.delThrows
        ? vi.fn().mockRejectedValue(new Error("Stripe customer delete failed"))
        : vi.fn().mockResolvedValue({ deleted: true }),
    },
    products: {
      create: vi.fn().mockResolvedValue({ id: "prod_TEST" }),
    },
    subscriptions: {
      create: vi.fn().mockResolvedValue({ id: STRIPE_SUB_ID }),
      cancel: vi.fn().mockResolvedValue({}),
    },
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("POST /api/mobile/organizations/signup — rollback on DB failure", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();

    // Ensure hCaptcha bypass: if HCAPTCHA_SECRET is unset, verifyHcaptchaToken
    // returns true immediately without calling the real hCaptcha API.
    vi.stubEnv("HCAPTCHA_SECRET", "");

    // Spy on the real module export so mobile.ts's live import binding is
    // intercepted — aligns with the task spec and reduces over-mocking.
    vi.spyOn(alertsModule, "sendGhostStripeAlert").mockResolvedValue(undefined);

    // Default: no existing user, DB write fails
    vi.mocked(storage.getUserByUsername).mockResolvedValue(undefined);
    vi.mocked(storage.getUserByEmailGlobal).mockResolvedValue(undefined);
    vi.mocked(storage.createMobileSignup).mockRejectedValue(
      new Error("DB connection lost"),
    );

    // Stripe: customers.create succeeds, customers.del throws
    vi.mocked(getUncachableStripeClient).mockResolvedValue(
      makeStripe({ delThrows: true }) as unknown as Stripe,
    );
  });

  it("returns HTTP 500 when the DB write fails after Stripe objects are created", async () => {
    const res = await request(buildApp())
      .post("/api/mobile/organizations/signup")
      .send(VALID_BODY);

    expect(res.status).toBe(500);
  });

  it("fires sendGhostStripeAlert when customers.del throws during rollback", async () => {
    await request(buildApp())
      .post("/api/mobile/organizations/signup")
      .send(VALID_BODY);

    expect(alertsModule.sendGhostStripeAlert).toHaveBeenCalledOnce();
  });

  it("passes the correct stripeCustomerId to sendGhostStripeAlert", async () => {
    await request(buildApp())
      .post("/api/mobile/organizations/signup")
      .send(VALID_BODY);

    expect(alertsModule.sendGhostStripeAlert).toHaveBeenCalledWith(
      expect.objectContaining({ stripeCustomerId: STRIPE_CUSTOMER_ID }),
    );
  });

  it("passes the correct stripeSubscriptionId to sendGhostStripeAlert", async () => {
    await request(buildApp())
      .post("/api/mobile/organizations/signup")
      .send(VALID_BODY);

    const [payload] = vi.mocked(alertsModule.sendGhostStripeAlert).mock
      .calls[0] as Parameters<typeof alertsModule.sendGhostStripeAlert>;
    expect(payload.stripeSubscriptionId).toBe(STRIPE_SUB_ID);
  });

  it("includes a customerDeleteError in the alert payload", async () => {
    await request(buildApp())
      .post("/api/mobile/organizations/signup")
      .send(VALID_BODY);

    const [payload] = vi.mocked(alertsModule.sendGhostStripeAlert).mock
      .calls[0] as Parameters<typeof alertsModule.sendGhostStripeAlert>;
    expect(payload.customerDeleteError).toBeInstanceOf(Error);
  });

  it("does NOT fire sendGhostStripeAlert when rollback fully succeeds", async () => {
    // Both subscriptions.cancel and customers.del succeed → no orphan alert
    vi.mocked(getUncachableStripeClient).mockResolvedValue(
      makeStripe({ delThrows: false }) as unknown as Stripe,
    );

    await request(buildApp())
      .post("/api/mobile/organizations/signup")
      .send(VALID_BODY);

    expect(alertsModule.sendGhostStripeAlert).not.toHaveBeenCalled();
  });

  it("returns 400 when required fields are missing", async () => {
    const res = await request(buildApp())
      .post("/api/mobile/organizations/signup")
      .send({ email: "bad@test.com" });

    expect(res.status).toBe(400);
  });

  it("returns 409 when an account with the same email already exists", async () => {
    vi.mocked(storage.getUserByUsername).mockResolvedValue(
      { id: 1, email: "jane@acme.com" } as unknown as User,
    );

    const res = await request(buildApp())
      .post("/api/mobile/organizations/signup")
      .send(VALID_BODY);

    expect(res.status).toBe(409);
    expect(alertsModule.sendGhostStripeAlert).not.toHaveBeenCalled();
  });
});
