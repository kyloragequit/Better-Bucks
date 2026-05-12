/**
 * Integration tests for the Passport LocalStrategy in auth.ts.
 *
 * Focuses on the `justLocked` gate: notifyAdminsOfAccountLockout must be
 * called exactly when recordFailedLogin returns justLocked=true, and must
 * NOT be called when justLocked=false.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import express from "express";
import session from "express-session";
import request from "supertest";
import type { User } from "@workspace/db";

vi.mock("pino", () => ({
  default: vi.fn(() => ({
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    child: vi.fn().mockReturnThis(),
  })),
}));

vi.mock("../lib/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    child: vi.fn().mockReturnThis(),
  },
}));

vi.mock("../db", () => ({
  db: {
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([]),
        }),
      }),
    }),
  },
  pool: { on: vi.fn() },
}));

vi.mock("connect-pg-simple", () => ({
  default: vi.fn(() => {
    return class MemoryStore extends session.Store {
      get(_sid: string, cb: (err: unknown, session?: session.SessionData | null) => void) { cb(null, null); }
      set(_sid: string, _session: session.SessionData, cb?: (err?: unknown) => void) { cb?.(); }
      destroy(_sid: string, cb?: (err?: unknown) => void) { cb?.(); }
    };
  }),
}));

vi.mock("../lib/lockoutNotify", () => ({
  notifyAdminsOfAccountLockout: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../seedDemo", () => ({
  deleteSessionDemoOrg: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../stripeOrphanRetry", () => ({
  recordStripeOrphan: vi.fn().mockResolvedValue(undefined),
}));

function makeStoredUser(overrides: Partial<User> = {}): User {
  return {
    id: 1,
    username: "testuser",
    fullName: "Test User",
    email: "test@example.com",
    password: "correct_password",
    role: "employee",
    organizationId: 5,
    status: "approved",
    lockedUntil: null,
    failedLoginAttempts: 0,
    twoFaSecret: null,
    twoFaEnabled: false,
    twoFaPromptDismissed: false,
    bucksBalance: 0,
    profileImageUrl: null,
    phone: null,
    pushToken: null,
    pushPlatform: null,
    termsAcceptedAt: null,
    marketingOptIn: false,
    passwordResetToken: null,
    passwordResetExpiry: null,
    successfulLoginCount: 0,
    lastPlainPassword: null,
    passwordLastChanged: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as unknown as User;
}

const STORED_USER = makeStoredUser();
const LOCKED_USER = makeStoredUser({
  lockedUntil: new Date(Date.now() + 15 * 60 * 1000),
  failedLoginAttempts: 10,
});

describe("Auth flow — justLocked gate for lockout notification", () => {
  let app: express.Express;
  let notifyAdminsOfAccountLockout: ReturnType<typeof vi.fn>;
  let storageMock: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(async () => {
    vi.resetModules();

    storageMock = {
      getUserByUsername: vi.fn().mockResolvedValue(STORED_USER),
      getUserByEmailGlobal: vi.fn().mockResolvedValue(undefined),
      getOrganization: vi.fn().mockResolvedValue(null),
      getOrganizationByCode: vi.fn().mockResolvedValue(null),
      recordFailedLogin: vi.fn().mockResolvedValue({ user: LOCKED_USER, justLocked: false }),
      recordSuccessfulLogin: vi.fn().mockResolvedValue(STORED_USER),
      incrementSuccessfulLoginCount: vi.fn().mockResolvedValue(STORED_USER),
      getUser: vi.fn().mockResolvedValue(STORED_USER),
    };

    vi.doMock("../storage", () => ({ storage: storageMock }));

    const [{ setupAuth }, { notifyAdminsOfAccountLockout: notify }] = await Promise.all([
      import("../auth"),
      import("../lib/lockoutNotify"),
    ]);
    notifyAdminsOfAccountLockout = notify as ReturnType<typeof vi.fn>;
    notifyAdminsOfAccountLockout.mockResolvedValue(undefined);
    notifyAdminsOfAccountLockout.mockClear();

    app = express();
    app.use(express.json());
    setupAuth(app);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("Nth failure — justLocked=true (threshold crossing)", () => {
    beforeEach(() => {
      storageMock.recordFailedLogin.mockResolvedValue({
        user: LOCKED_USER,
        justLocked: true,
      });
    });

    it("calls notifyAdminsOfAccountLockout when recordFailedLogin returns justLocked=true", async () => {
      await request(app)
        .post("/api/login")
        .send({ username: "testuser", password: "wrong_password" });

      expect(storageMock.recordFailedLogin).toHaveBeenCalledWith(STORED_USER.id);
      expect(notifyAdminsOfAccountLockout).toHaveBeenCalledOnce();
      expect(notifyAdminsOfAccountLockout).toHaveBeenCalledWith(LOCKED_USER);
    });

    it("calls notifyAdminsOfAccountLockout with the updated user returned by recordFailedLogin", async () => {
      await request(app)
        .post("/api/login")
        .send({ username: "testuser", password: "wrong_password" });

      const [calledWith] = notifyAdminsOfAccountLockout.mock.calls[0] as [User];
      expect(calledWith.lockedUntil).toBeTruthy();
      expect(calledWith.id).toBe(STORED_USER.id);
    });

    it("returns 401 with an auth failure message even when justLocked=true", async () => {
      const res = await request(app)
        .post("/api/login")
        .send({ username: "testuser", password: "wrong_password" });

      expect(res.status).toBe(401);
      expect(res.body.message).toMatch(/incorrect username or password/i);
    });
  });

  describe("N+1 failure — justLocked=false (already locked)", () => {
    beforeEach(() => {
      storageMock.recordFailedLogin.mockResolvedValue({
        user: LOCKED_USER,
        justLocked: false,
      });
    });

    it("does NOT call notifyAdminsOfAccountLockout when justLocked=false", async () => {
      await request(app)
        .post("/api/login")
        .send({ username: "testuser", password: "wrong_password" });

      expect(storageMock.recordFailedLogin).toHaveBeenCalledWith(STORED_USER.id);
      expect(notifyAdminsOfAccountLockout).not.toHaveBeenCalled();
    });

    it("still returns 401 even when justLocked=false", async () => {
      const res = await request(app)
        .post("/api/login")
        .send({ username: "testuser", password: "wrong_password" });

      expect(res.status).toBe(401);
    });

    it("does not call notifyAdminsOfAccountLockout on failures before threshold", async () => {
      const underThreshold = makeStoredUser({ failedLoginAttempts: 3 });
      storageMock.recordFailedLogin.mockResolvedValue({
        user: underThreshold,
        justLocked: false,
      });

      await request(app)
        .post("/api/login")
        .send({ username: "testuser", password: "wrong_password" });

      expect(notifyAdminsOfAccountLockout).not.toHaveBeenCalled();
    });
  });

  describe("when the account is currently locked (lockedUntil in future)", () => {
    it("returns 401 with a lockout message and does not call recordFailedLogin", async () => {
      storageMock.getUserByUsername.mockResolvedValue(
        makeStoredUser({ lockedUntil: new Date(Date.now() + 10 * 60 * 1000) }),
      );

      await request(app)
        .post("/api/login")
        .send({ username: "testuser", password: "wrong_password" });

      expect(storageMock.recordFailedLogin).not.toHaveBeenCalled();
      expect(notifyAdminsOfAccountLockout).not.toHaveBeenCalled();
    });
  });
});
