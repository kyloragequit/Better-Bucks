/**
 * Unit tests for storage.recordFailedLogin — specifically the `justLocked` flag.
 *
 * The flag must be true exactly once: the moment the failed-login count
 * crosses the threshold. Subsequent attempts while the lock is still active
 * must return justLocked=false so the lockout email fires exactly once.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
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

type TxMockOptions = {
  currentUser: {
    failedLoginAttempts: number;
    lockedUntil: Date | null;
    organizationId: number | null;
  };
  org?: { maxFailedAttempts: number; lockoutDurationMinutes: number } | null;
  updatedUser: Partial<User>;
};

function makeMockTx({ currentUser, org, updatedUser }: TxMockOptions) {
  let selectCount = 0;

  return {
    select: vi.fn().mockImplementation(() => {
      const thisCall = selectCount++;
      return {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue(
            thisCall === 0
              ? {
                  for: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue([currentUser]),
                  }),
                }
              : {
                  limit: vi.fn().mockResolvedValue(org ? [org] : []),
                },
          ),
        }),
      };
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([updatedUser]),
        }),
      }),
    }),
  };
}

describe("storage.recordFailedLogin — justLocked transitions", () => {
  let recordFailedLogin: (userId: number) => Promise<{ user: User; justLocked: boolean }>;
  let mockDb: { transaction: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    vi.resetModules();
    vi.unstubAllEnvs();

    mockDb = { transaction: vi.fn() };

    vi.doMock("../db", () => ({
      db: mockDb,
      pool: { on: vi.fn() },
    }));

    const { storage } = await import("../storage");
    recordFailedLogin = storage.recordFailedLogin.bind(storage);
  });

  afterEach(() => {
    vi.resetAllMocks();
    vi.unstubAllEnvs();
  });

  function setupTransaction(opts: TxMockOptions) {
    const tx = makeMockTx(opts);
    mockDb.transaction.mockImplementation(async (callback: (tx: typeof tx) => Promise<unknown>) => {
      return await callback(tx);
    });
  }

  describe("justLocked=true — exactly at the threshold crossing (Nth failure)", () => {
    it("returns justLocked=true when count reaches the default threshold of 10", async () => {
      vi.stubEnv("LOCKOUT_MAX_ATTEMPTS", "10");
      const updatedUser = { id: 1, failedLoginAttempts: 10 } as unknown as User;
      setupTransaction({
        currentUser: { failedLoginAttempts: 9, lockedUntil: null, organizationId: null },
        updatedUser,
      });

      const result = await recordFailedLogin(1);

      expect(result.justLocked).toBe(true);
    });

    it("returns justLocked=true when count reaches a custom threshold (env override)", async () => {
      vi.stubEnv("LOCKOUT_MAX_ATTEMPTS", "5");
      const updatedUser = { id: 1, failedLoginAttempts: 5 } as unknown as User;
      setupTransaction({
        currentUser: { failedLoginAttempts: 4, lockedUntil: null, organizationId: null },
        updatedUser,
      });

      const result = await recordFailedLogin(1);

      expect(result.justLocked).toBe(true);
    });

    it("returns justLocked=true when count reaches the org-level threshold", async () => {
      const updatedUser = { id: 1, failedLoginAttempts: 3 } as unknown as User;
      setupTransaction({
        currentUser: { failedLoginAttempts: 2, lockedUntil: null, organizationId: 7 },
        org: { maxFailedAttempts: 3, lockoutDurationMinutes: 15 },
        updatedUser,
      });

      const result = await recordFailedLogin(1);

      expect(result.justLocked).toBe(true);
    });

    it("returns justLocked=true when count exceeds threshold (e.g. threshold=1, first attempt)", async () => {
      vi.stubEnv("LOCKOUT_MAX_ATTEMPTS", "1");
      const updatedUser = { id: 1, failedLoginAttempts: 1 } as unknown as User;
      setupTransaction({
        currentUser: { failedLoginAttempts: 0, lockedUntil: null, organizationId: null },
        updatedUser,
      });

      const result = await recordFailedLogin(1);

      expect(result.justLocked).toBe(true);
    });
  });

  describe("justLocked=false — N+1 failure while lock is still active", () => {
    it("returns justLocked=false when the account is already locked (lockedUntil in future)", async () => {
      vi.stubEnv("LOCKOUT_MAX_ATTEMPTS", "10");
      const futureDate = new Date(Date.now() + 15 * 60 * 1000);
      const updatedUser = { id: 1, failedLoginAttempts: 11, lockedUntil: futureDate } as unknown as User;
      setupTransaction({
        currentUser: {
          failedLoginAttempts: 10,
          lockedUntil: futureDate,
          organizationId: null,
        },
        updatedUser,
      });

      const result = await recordFailedLogin(1);

      expect(result.justLocked).toBe(false);
    });

    it("returns justLocked=false on the 2nd attempt after threshold (count=11)", async () => {
      vi.stubEnv("LOCKOUT_MAX_ATTEMPTS", "10");
      const futureDate = new Date(Date.now() + 15 * 60 * 1000);
      const updatedUser = { id: 1, failedLoginAttempts: 12, lockedUntil: futureDate } as unknown as User;
      setupTransaction({
        currentUser: {
          failedLoginAttempts: 11,
          lockedUntil: futureDate,
          organizationId: null,
        },
        updatedUser,
      });

      const result = await recordFailedLogin(1);

      expect(result.justLocked).toBe(false);
    });

    it("returns justLocked=false when org threshold is already exceeded and account is locked", async () => {
      const futureDate = new Date(Date.now() + 10 * 60 * 1000);
      const updatedUser = { id: 1, failedLoginAttempts: 4, lockedUntil: futureDate } as unknown as User;
      setupTransaction({
        currentUser: {
          failedLoginAttempts: 3,
          lockedUntil: futureDate,
          organizationId: 7,
        },
        org: { maxFailedAttempts: 3, lockoutDurationMinutes: 10 },
        updatedUser,
      });

      const result = await recordFailedLogin(1);

      expect(result.justLocked).toBe(false);
    });
  });

  describe("justLocked=false — failures below threshold", () => {
    it("returns justLocked=false for the 1st failure (below threshold)", async () => {
      vi.stubEnv("LOCKOUT_MAX_ATTEMPTS", "10");
      const updatedUser = { id: 1, failedLoginAttempts: 1 } as unknown as User;
      setupTransaction({
        currentUser: { failedLoginAttempts: 0, lockedUntil: null, organizationId: null },
        updatedUser,
      });

      const result = await recordFailedLogin(1);

      expect(result.justLocked).toBe(false);
    });

    it("returns justLocked=false for failure N-1 (one below threshold)", async () => {
      vi.stubEnv("LOCKOUT_MAX_ATTEMPTS", "10");
      const updatedUser = { id: 1, failedLoginAttempts: 9 } as unknown as User;
      setupTransaction({
        currentUser: { failedLoginAttempts: 8, lockedUntil: null, organizationId: null },
        updatedUser,
      });

      const result = await recordFailedLogin(1);

      expect(result.justLocked).toBe(false);
    });
  });

  describe("lockout streak reset after expiry", () => {
    it("returns justLocked=true after an expired lockout when the new streak hits threshold=1", async () => {
      vi.stubEnv("LOCKOUT_MAX_ATTEMPTS", "1");
      const pastDate = new Date(Date.now() - 60 * 1000);
      const updatedUser = { id: 1, failedLoginAttempts: 1 } as unknown as User;
      setupTransaction({
        currentUser: {
          failedLoginAttempts: 10,
          lockedUntil: pastDate,
          organizationId: null,
        },
        updatedUser,
      });

      const result = await recordFailedLogin(1);

      expect(result.justLocked).toBe(true);
    });

    it("returns justLocked=false for the 1st attempt of a reset streak when threshold > 1", async () => {
      vi.stubEnv("LOCKOUT_MAX_ATTEMPTS", "10");
      const pastDate = new Date(Date.now() - 60 * 1000);
      const updatedUser = { id: 1, failedLoginAttempts: 1 } as unknown as User;
      setupTransaction({
        currentUser: {
          failedLoginAttempts: 10,
          lockedUntil: pastDate,
          organizationId: null,
        },
        updatedUser,
      });

      const result = await recordFailedLogin(1);

      expect(result.justLocked).toBe(false);
    });
  });

  describe("return shape", () => {
    it("returns the updated user from the database", async () => {
      vi.stubEnv("LOCKOUT_MAX_ATTEMPTS", "10");
      const updatedUser = {
        id: 42,
        username: "targetuser",
        failedLoginAttempts: 5,
      } as unknown as User;
      setupTransaction({
        currentUser: { failedLoginAttempts: 4, lockedUntil: null, organizationId: null },
        updatedUser,
      });

      const result = await recordFailedLogin(42);

      expect(result.user).toBe(updatedUser);
    });
  });
});
