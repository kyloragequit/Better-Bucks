import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("pino", () => {
  const info = vi.fn();
  const warn = vi.fn();
  const pinoFn = vi.fn(() => ({ info, warn }));
  return { default: pinoFn };
});

vi.mock("../lib/email", () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../storage", () => ({
  storage: {
    getOrganization: vi.fn(),
    getUsersByOrganization: vi.fn(),
  },
}));

import type { User } from "@workspace/db";

function makeEmployee(overrides: Partial<User> = {}): User {
  return {
    id: 1,
    username: "jsmith",
    fullName: "Jane Smith",
    email: "jane@example.com",
    role: "employee",
    organizationId: 10,
    status: "approved",
    password: "hashed",
    lockedUntil: new Date(Date.now() + 15 * 60 * 1000),
    failedLoginAttempts: 10,
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
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as unknown as User;
}

function makeAdmin(overrides: Partial<User> = {}): User {
  return makeEmployee({
    id: 99,
    username: "admin1",
    fullName: "Admin One",
    email: "admin@example.com",
    role: "prime_admin",
    organizationId: 10,
    status: "approved",
    lockedUntil: null,
    failedLoginAttempts: 0,
    ...overrides,
  });
}

describe("notifyAdminsOfAccountLockout", () => {
  let notifyAdminsOfAccountLockout: (user: User) => Promise<void>;
  let sendEmail: ReturnType<typeof vi.fn>;
  let getOrganization: ReturnType<typeof vi.fn>;
  let getUsersByOrganization: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.resetModules();
    ({ notifyAdminsOfAccountLockout } = await import("../lib/lockoutNotify"));
    sendEmail = (await import("../lib/email")).sendEmail as ReturnType<typeof vi.fn>;
    sendEmail.mockResolvedValue(undefined);
    const { storage } = await import("../storage");
    getOrganization = storage.getOrganization as ReturnType<typeof vi.fn>;
    getUsersByOrganization = storage.getUsersByOrganization as ReturnType<typeof vi.fn>;
    // Default: no securityAlertEmail → fall through to user list
    getOrganization.mockResolvedValue({ id: 10, securityAlertEmail: null });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("when called on the Nth (threshold) failure — justLocked scenario", () => {
    it("calls sendEmail for each approved admin in the organization", async () => {
      const employee = makeEmployee();
      const admin1 = makeAdmin({ id: 101, email: "admin1@example.com" });
      const admin2 = makeAdmin({ id: 102, email: "admin2@example.com", role: "admin" });
      getUsersByOrganization.mockResolvedValue([employee, admin1, admin2]);

      await notifyAdminsOfAccountLockout(employee);

      expect(sendEmail).toHaveBeenCalledTimes(2);
      const recipients = (sendEmail.mock.calls as Array<[{ to: string }]>).map(
        ([args]) => args.to,
      );
      expect(recipients).toContain("admin1@example.com");
      expect(recipients).toContain("admin2@example.com");
    });

    it("includes the locked employee's name in the email HTML", async () => {
      const employee = makeEmployee({ fullName: "Jane Smith" });
      getUsersByOrganization.mockResolvedValue([makeAdmin()]);

      await notifyAdminsOfAccountLockout(employee);

      const html = (sendEmail.mock.calls[0] as [{ html: string }])[0].html;
      expect(html).toContain("Jane Smith");
    });

    it("includes the employee's username in the email HTML", async () => {
      const employee = makeEmployee({ username: "jsmith" });
      getUsersByOrganization.mockResolvedValue([makeAdmin()]);

      await notifyAdminsOfAccountLockout(employee);

      const html = (sendEmail.mock.calls[0] as [{ html: string }])[0].html;
      expect(html).toContain("jsmith");
    });

    it("uses the correct subject line", async () => {
      const employee = makeEmployee({ fullName: "Jane Smith" });
      getUsersByOrganization.mockResolvedValue([makeAdmin()]);

      await notifyAdminsOfAccountLockout(employee);

      const subject = (sendEmail.mock.calls[0] as [{ subject: string }])[0].subject;
      expect(subject).toContain("Account locked");
      expect(subject).toContain("Jane Smith");
    });

    it("de-duplicates admin email addresses so each address is only emailed once", async () => {
      const employee = makeEmployee();
      const admin1 = makeAdmin({ id: 101, email: "shared@example.com" });
      const admin2 = makeAdmin({ id: 102, email: "shared@example.com", role: "admin" });
      getUsersByOrganization.mockResolvedValue([employee, admin1, admin2]);

      await notifyAdminsOfAccountLockout(employee);

      expect(sendEmail).toHaveBeenCalledTimes(1);
      const [args] = sendEmail.mock.calls[0] as [{ to: string }];
      expect(args.to).toBe("shared@example.com");
    });

    it("queries the correct organization when looking up admins", async () => {
      const employee = makeEmployee({ organizationId: 42 });
      getOrganization.mockResolvedValue({ id: 42, securityAlertEmail: null });
      getUsersByOrganization.mockResolvedValue([makeAdmin({ organizationId: 42 })]);

      await notifyAdminsOfAccountLockout(employee);

      expect(getOrganization).toHaveBeenCalledWith(42);
      expect(getUsersByOrganization).toHaveBeenCalledWith(42);
    });
  });

  describe("security inbox path — org has a securityAlertEmail configured", () => {
    it("sends to the securityAlertEmail instead of individual admins", async () => {
      const employee = makeEmployee();
      getOrganization.mockResolvedValue({ id: 10, securityAlertEmail: "security@corp.com" });

      await notifyAdminsOfAccountLockout(employee);

      expect(sendEmail).toHaveBeenCalledOnce();
      const [args] = sendEmail.mock.calls[0] as [{ to: string }];
      expect(args.to).toBe("security@corp.com");
    });

    it("does NOT call getUsersByOrganization when securityAlertEmail is set", async () => {
      const employee = makeEmployee();
      getOrganization.mockResolvedValue({ id: 10, securityAlertEmail: "security@corp.com" });

      await notifyAdminsOfAccountLockout(employee);

      expect(getUsersByOrganization).not.toHaveBeenCalled();
    });

    it("includes the employee name in the HTML when using securityAlertEmail path", async () => {
      const employee = makeEmployee({ fullName: "Jane Smith" });
      getOrganization.mockResolvedValue({ id: 10, securityAlertEmail: "sec@corp.com" });

      await notifyAdminsOfAccountLockout(employee);

      const html = (sendEmail.mock.calls[0] as [{ html: string }])[0].html;
      expect(html).toContain("Jane Smith");
    });
  });

  describe("when the account is still locked — N+1 failure scenario", () => {
    it("does not call sendEmail when there are no approved admins in the org", async () => {
      const employee = makeEmployee();
      const pendingAdmin = makeAdmin({ status: "pending", email: "pending@example.com" });
      const anotherEmployee = makeEmployee({ id: 2, email: "emp2@example.com" });
      getUsersByOrganization.mockResolvedValue([employee, pendingAdmin, anotherEmployee]);

      await notifyAdminsOfAccountLockout(employee);

      expect(sendEmail).not.toHaveBeenCalled();
    });

    it("does not call getOrganization or sendEmail for a non-employee role", async () => {
      const adminUser = makeEmployee({ role: "admin" });

      await notifyAdminsOfAccountLockout(adminUser);

      expect(getOrganization).not.toHaveBeenCalled();
      expect(getUsersByOrganization).not.toHaveBeenCalled();
      expect(sendEmail).not.toHaveBeenCalled();
    });
  });

  describe("when the user has no organization", () => {
    it("returns immediately without calling getOrganization", async () => {
      const employee = makeEmployee({ organizationId: null });

      await notifyAdminsOfAccountLockout(employee);

      expect(getOrganization).not.toHaveBeenCalled();
    });

    it("returns immediately without calling getUsersByOrganization", async () => {
      const employee = makeEmployee({ organizationId: null });

      await notifyAdminsOfAccountLockout(employee);

      expect(getUsersByOrganization).not.toHaveBeenCalled();
    });

    it("does not send any email", async () => {
      const employee = makeEmployee({ organizationId: null });

      await notifyAdminsOfAccountLockout(employee);

      expect(sendEmail).not.toHaveBeenCalled();
    });

    it("resolves without throwing", async () => {
      const employee = makeEmployee({ organizationId: null });

      await expect(notifyAdminsOfAccountLockout(employee)).resolves.toBeUndefined();
    });
  });

  describe("error handling — errors must not propagate to the caller", () => {
    it("resolves without throwing when sendEmail rejects", async () => {
      const employee = makeEmployee();
      getUsersByOrganization.mockResolvedValue([makeAdmin()]);
      sendEmail.mockRejectedValue(new Error("SMTP connection refused"));

      await expect(notifyAdminsOfAccountLockout(employee)).resolves.toBeUndefined();
    });

    it("still resolves when all sendEmail calls reject", async () => {
      const employee = makeEmployee();
      const admin1 = makeAdmin({ id: 101, email: "admin1@example.com" });
      const admin2 = makeAdmin({ id: 102, email: "admin2@example.com" });
      getUsersByOrganization.mockResolvedValue([admin1, admin2]);
      sendEmail.mockRejectedValue(new Error("Mail server unreachable"));

      await expect(notifyAdminsOfAccountLockout(employee)).resolves.toBeUndefined();
    });

    it("resolves without throwing when getUsersByOrganization rejects", async () => {
      const employee = makeEmployee();
      getUsersByOrganization.mockRejectedValue(new Error("DB connection lost"));

      await expect(notifyAdminsOfAccountLockout(employee)).resolves.toBeUndefined();
    });

    it("does not call sendEmail when getUsersByOrganization throws", async () => {
      const employee = makeEmployee();
      getUsersByOrganization.mockRejectedValue(new Error("Query timeout"));

      await notifyAdminsOfAccountLockout(employee);

      expect(sendEmail).not.toHaveBeenCalled();
    });

    it("resolves without throwing when getOrganization rejects", async () => {
      const employee = makeEmployee();
      getOrganization.mockRejectedValue(new Error("DB offline"));

      await expect(notifyAdminsOfAccountLockout(employee)).resolves.toBeUndefined();
    });

    it("still sends to other admins when one sendEmail call fails", async () => {
      const employee = makeEmployee();
      const admin1 = makeAdmin({ id: 101, email: "admin1@example.com" });
      const admin2 = makeAdmin({ id: 102, email: "admin2@example.com" });
      getUsersByOrganization.mockResolvedValue([employee, admin1, admin2]);
      sendEmail
        .mockRejectedValueOnce(new Error("admin1 mailbox full"))
        .mockResolvedValue(undefined);

      await expect(notifyAdminsOfAccountLockout(employee)).resolves.toBeUndefined();
      expect(sendEmail).toHaveBeenCalledTimes(2);
    });
  });

  describe("admin filtering", () => {
    it("does not email admins with status other than approved", async () => {
      const employee = makeEmployee();
      const suspended = makeAdmin({ status: "suspended", email: "suspended@example.com" });
      const pending = makeAdmin({ status: "pending", email: "pending@example.com" });
      const approved = makeAdmin({ status: "approved", email: "approved@example.com" });
      getUsersByOrganization.mockResolvedValue([employee, suspended, pending, approved]);

      await notifyAdminsOfAccountLockout(employee);

      expect(sendEmail).toHaveBeenCalledTimes(1);
      const [args] = sendEmail.mock.calls[0] as [{ to: string }];
      expect(args.to).toBe("approved@example.com");
    });

    it("does not email admins with no email address", async () => {
      const employee = makeEmployee();
      const noEmail = makeAdmin({ email: null });
      const withEmail = makeAdmin({ id: 200, email: "real@example.com" });
      getUsersByOrganization.mockResolvedValue([employee, noEmail, withEmail]);

      await notifyAdminsOfAccountLockout(employee);

      expect(sendEmail).toHaveBeenCalledTimes(1);
      const [args] = sendEmail.mock.calls[0] as [{ to: string }];
      expect(args.to).toBe("real@example.com");
    });

    it("emails both prime_admin and admin roles", async () => {
      const employee = makeEmployee();
      const primeAdmin = makeAdmin({ id: 201, email: "prime@example.com", role: "prime_admin" });
      const regularAdmin = makeAdmin({ id: 202, email: "regular@example.com", role: "admin" });
      getUsersByOrganization.mockResolvedValue([employee, primeAdmin, regularAdmin]);

      await notifyAdminsOfAccountLockout(employee);

      expect(sendEmail).toHaveBeenCalledTimes(2);
    });

    it("does not email employee-role users from the org", async () => {
      const employee = makeEmployee();
      const colleague = makeEmployee({ id: 5, email: "colleague@example.com" });
      const admin = makeAdmin({ id: 201, email: "boss@example.com" });
      getUsersByOrganization.mockResolvedValue([employee, colleague, admin]);

      await notifyAdminsOfAccountLockout(employee);

      expect(sendEmail).toHaveBeenCalledTimes(1);
      const [args] = sendEmail.mock.calls[0] as [{ to: string }];
      expect(args.to).toBe("boss@example.com");
    });

    it("returns without sending when the org has no users at all", async () => {
      const employee = makeEmployee();
      getUsersByOrganization.mockResolvedValue([]);

      await notifyAdminsOfAccountLockout(employee);

      expect(sendEmail).not.toHaveBeenCalled();
    });
  });

  describe("HTML escaping", () => {
    it("escapes HTML special characters in the employee name", async () => {
      const employee = makeEmployee({ fullName: '<script>alert("xss")</script>' });
      getUsersByOrganization.mockResolvedValue([makeAdmin()]);

      await notifyAdminsOfAccountLockout(employee);

      const html = (sendEmail.mock.calls[0] as [{ html: string }])[0].html;
      expect(html).not.toContain("<script>");
      expect(html).toContain("&lt;script&gt;");
    });

    it("escapes HTML special characters in the username", async () => {
      const employee = makeEmployee({ username: 'user"name' });
      getUsersByOrganization.mockResolvedValue([makeAdmin()]);

      await notifyAdminsOfAccountLockout(employee);

      const html = (sendEmail.mock.calls[0] as [{ html: string }])[0].html;
      expect(html).not.toContain('"name');
      expect(html).toContain("&quot;name");
    });
  });
});
