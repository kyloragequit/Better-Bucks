import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import forge from "node-forge";
import type { User } from "@workspace/db";

// ── Module mocks (hoisted before any imports that pull in these modules) ────

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

vi.mock("../storage", () => ({
  storage: {
    getUser: vi.fn(),
    getOrganization: vi.fn(),
  },
}));

// ── Imports (after mocks) ────────────────────────────────────────────────────

import { storage } from "../storage";
import { buildGoogleWalletSaveUrl, GoogleWalletConfigError } from "../googleWalletPass";

// ── Helpers ──────────────────────────────────────────────────────────────────

const SAVE_URL_PREFIX = "https://pay.google.com/gp/v/save/";

function decodeJwtPart(b64url: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(b64url, "base64url").toString("utf-8"));
}

// ── Typed fixtures ────────────────────────────────────────────────────────────

const MOCK_EMPLOYEE: User = {
  id: 42,
  username: "emp_test",
  password: "hashed-password",
  role: "employee",
  status: "approved",
  balance: 250,
  barcode: "BB-EMP-42",
  fullName: "Jane Employee",
  mustChangePassword: false,
  passwordLastChanged: null,
  email: "emp@example.com",
  phone: null,
  emailVerified: true,
  emailVerificationCode: null,
  passwordResetToken: null,
  passwordResetExpiry: null,
  organizationId: null,
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

// ── Test RSA key (512-bit — fast to generate, tests only) ────────────────────

let testPrivateKeyPem: string;

beforeAll(() => {
  const keypair = forge.pki.rsa.generateKeyPair({ bits: 512, e: 0x10001 });
  testPrivateKeyPem = forge.pki.privateKeyToPem(keypair.privateKey);
});

// ── Unit tests for buildGoogleWalletSaveUrl ──────────────────────────────────

describe("buildGoogleWalletSaveUrl — config error path", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it("throws GoogleWalletConfigError when all env vars are absent", async () => {
    await expect(buildGoogleWalletSaveUrl(1)).rejects.toThrow(
      GoogleWalletConfigError,
    );
  });

  it("throws GoogleWalletConfigError when only some env vars are set", async () => {
    vi.stubEnv("GOOGLE_WALLET_ISSUER_ID", "test-issuer");
    vi.stubEnv("GOOGLE_WALLET_CLASS_ID", "test-class");
    // GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY absent

    await expect(buildGoogleWalletSaveUrl(1)).rejects.toThrow(
      GoogleWalletConfigError,
    );
  });

  it("error message lists the missing secret names", async () => {
    vi.stubEnv("GOOGLE_WALLET_ISSUER_ID", "test-issuer");
    // all others absent

    const err = await buildGoogleWalletSaveUrl(1).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(GoogleWalletConfigError);
    expect((err as Error).message).toContain("GOOGLE_WALLET_CLASS_ID");
    expect((err as Error).message).toContain("GOOGLE_SERVICE_ACCOUNT_EMAIL");
    expect((err as Error).message).toContain("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY");
  });
});

describe("buildGoogleWalletSaveUrl — happy path", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();

    vi.stubEnv("GOOGLE_WALLET_ISSUER_ID", "test-issuer-id");
    vi.stubEnv("GOOGLE_WALLET_CLASS_ID", "test-class-id");
    vi.stubEnv(
      "GOOGLE_SERVICE_ACCOUNT_EMAIL",
      "wallet-sa@test-project.iam.gserviceaccount.com",
    );

    vi.mocked(storage.getUser).mockResolvedValue(MOCK_EMPLOYEE);
    vi.mocked(storage.getOrganization).mockResolvedValue(undefined);
  });

  function stubPrivateKey() {
    vi.stubEnv("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY", testPrivateKeyPem);
  }

  it("returns a URL that starts with the Google Wallet save prefix", async () => {
    stubPrivateKey();
    const url = await buildGoogleWalletSaveUrl(42);
    expect(url).toMatch(/^https:\/\/pay\.google\.com\/gp\/v\/save\//);
  });

  it("appends a three-part JWT (header.payload.signature) after the prefix", async () => {
    stubPrivateKey();
    const url = await buildGoogleWalletSaveUrl(42);
    const jwt = url.slice(SAVE_URL_PREFIX.length);
    const parts = jwt.split(".");
    expect(parts).toHaveLength(3);
    expect(parts[0].length).toBeGreaterThan(0);
    expect(parts[1].length).toBeGreaterThan(0);
    expect(parts[2].length).toBeGreaterThan(0);
  });

  it("encodes RS256 as the algorithm in the JWT header", async () => {
    stubPrivateKey();
    const url = await buildGoogleWalletSaveUrl(42);
    const jwt = url.slice(SAVE_URL_PREFIX.length);
    const header = decodeJwtPart(jwt.split(".")[0]);
    expect(header.alg).toBe("RS256");
  });

  it("sets typ to JWT in the JWT header", async () => {
    stubPrivateKey();
    const url = await buildGoogleWalletSaveUrl(42);
    const jwt = url.slice(SAVE_URL_PREFIX.length);
    const header = decodeJwtPart(jwt.split(".")[0]);
    expect(header.typ).toBe("JWT");
  });

  it("accepts a base64-encoded PEM and still produces a valid save URL", async () => {
    const b64Pem = Buffer.from(testPrivateKeyPem).toString("base64");
    vi.stubEnv("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY", b64Pem);

    const url = await buildGoogleWalletSaveUrl(42);
    expect(url).toMatch(/^https:\/\/pay\.google\.com\/gp\/v\/save\//);
    const jwt = url.slice(SAVE_URL_PREFIX.length);
    expect(jwt.split(".")).toHaveLength(3);
  });

  it("includes the employee id in the JWT payload object id", async () => {
    stubPrivateKey();
    const url = await buildGoogleWalletSaveUrl(42);
    const jwt = url.slice(SAVE_URL_PREFIX.length);
    const payload = decodeJwtPart(jwt.split(".")[1]);
    const objects = (payload.payload as { genericObjects: Array<{ id: string }> })
      .genericObjects;
    expect(objects[0].id).toContain("42");
  });
});
