import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { GhostStripeAlertPayload, OrphanPermanentFailurePayload } from "../lib/alerts";

vi.mock("pino", () => {
  const warn = vi.fn();
  const error = vi.fn();
  const pinoFn = vi.fn(() => ({ warn, error }));
  return { default: pinoFn };
});

vi.mock("nodemailer", () => {
  const sendMail = vi.fn().mockResolvedValue({ messageId: "test-id" });
  const createTransport = vi.fn(() => ({ sendMail }));
  return { default: { createTransport } };
});

vi.mock("@replit/connectors-sdk", () => {
  return {
    ReplitConnectors: vi.fn(() => ({
      proxy: vi.fn().mockRejectedValue(new Error("Gmail API unavailable in tests")),
    })),
  };
});

const PAYLOAD: GhostStripeAlertPayload = {
  stripeCustomerId: "cus_TEST123",
  stripeSubscriptionId: "sub_TEST456",
};

const PAYLOAD_WITH_ERRORS: GhostStripeAlertPayload = {
  stripeCustomerId: "cus_GHOST",
  stripeSubscriptionId: "sub_GHOST",
  subCancelError: new Error("Subscription cancel network timeout"),
  customerDeleteError: new Error("Customer delete rate-limited"),
};

const PAYLOAD_NULL_IDS: GhostStripeAlertPayload = {
  stripeCustomerId: null,
  stripeSubscriptionId: null,
  subCancelError: new Error("cancel failed"),
};

const ORPHAN_PAYLOAD: OrphanPermanentFailurePayload = {
  orphanId: 42,
  stripeCustomerId: "cus_ORPHAN123",
  stripeSubscriptionId: "sub_ORPHAN456",
  lastError: "Stripe rate limit exceeded",
  retryCount: 5,
};

const ORPHAN_PAYLOAD_NULL_IDS: OrphanPermanentFailurePayload = {
  orphanId: 99,
  stripeCustomerId: null,
  stripeSubscriptionId: null,
  lastError: "Connection timeout",
  retryCount: 5,
};

const ORPHAN_PAYLOAD_NO_ERROR: OrphanPermanentFailurePayload = {
  orphanId: 7,
  stripeCustomerId: "cus_NOERR",
  stripeSubscriptionId: null,
  lastError: null,
  retryCount: 5,
};

function makeOkFetch() {
  return vi.fn().mockResolvedValue({ ok: true, status: 200 });
}

function makeBadFetch(status = 500) {
  return vi.fn().mockResolvedValue({ ok: false, status });
}

describe("sendGhostStripeAlert", () => {
  let sendGhostStripeAlert: (payload: GhostStripeAlertPayload) => Promise<void>;
  let nodemailer: typeof import("nodemailer");

  beforeEach(async () => {
    vi.resetModules();
    ({ sendGhostStripeAlert } = await import("../lib/alerts"));
    nodemailer = (await import("nodemailer")).default as unknown as typeof import("nodemailer");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  describe("when no alert destination is configured", () => {
    it("does not throw and returns silently", async () => {
      vi.stubEnv("ALERT_WEBHOOK_URL", "");
      vi.stubEnv("ADMIN_ALERT_EMAIL", "");
      const fetchMock = makeOkFetch();
      vi.stubGlobal("fetch", fetchMock);

      await expect(sendGhostStripeAlert(PAYLOAD)).resolves.toBeUndefined();
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe("Slack webhook path", () => {
    const WEBHOOK_URL = "https://hooks.slack.com/services/TEST/WEBHOOK";

    beforeEach(() => {
      vi.stubEnv("ALERT_WEBHOOK_URL", WEBHOOK_URL);
      vi.stubEnv("ADMIN_ALERT_EMAIL", "");
    });

    it("POSTs to the Slack webhook URL with JSON content-type", async () => {
      const fetchMock = makeOkFetch();
      vi.stubGlobal("fetch", fetchMock);

      await sendGhostStripeAlert(PAYLOAD);

      expect(fetchMock).toHaveBeenCalledOnce();
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(WEBHOOK_URL);
      expect(init.method).toBe("POST");
      expect((init.headers as Record<string, string>)["Content-Type"]).toBe(
        "application/json",
      );
    });

    it("includes stripeCustomerId in the Slack message body", async () => {
      const fetchMock = makeOkFetch();
      vi.stubGlobal("fetch", fetchMock);

      await sendGhostStripeAlert(PAYLOAD);

      const body = JSON.parse(fetchMock.mock.calls[0][1].body as string) as {
        text: string;
      };
      expect(body.text).toContain(PAYLOAD.stripeCustomerId);
    });

    it("includes stripeSubscriptionId in the Slack message body", async () => {
      const fetchMock = makeOkFetch();
      vi.stubGlobal("fetch", fetchMock);

      await sendGhostStripeAlert(PAYLOAD);

      const body = JSON.parse(fetchMock.mock.calls[0][1].body as string) as {
        text: string;
      };
      expect(body.text).toContain(PAYLOAD.stripeSubscriptionId);
    });

    it("includes rollback error messages in the Slack body", async () => {
      const fetchMock = makeOkFetch();
      vi.stubGlobal("fetch", fetchMock);

      await sendGhostStripeAlert(PAYLOAD_WITH_ERRORS);

      const body = JSON.parse(fetchMock.mock.calls[0][1].body as string) as {
        text: string;
      };
      expect(body.text).toContain("Subscription cancel network timeout");
      expect(body.text).toContain("Customer delete rate-limited");
    });

    it("handles null IDs gracefully in the Slack body", async () => {
      const fetchMock = makeOkFetch();
      vi.stubGlobal("fetch", fetchMock);

      await sendGhostStripeAlert(PAYLOAD_NULL_IDS);

      const body = JSON.parse(fetchMock.mock.calls[0][1].body as string) as {
        text: string;
      };
      expect(body.text).toContain("none");
    });

    it("does not throw when the Slack webhook returns a non-ok status", async () => {
      vi.stubGlobal("fetch", makeBadFetch(400));

      await expect(sendGhostStripeAlert(PAYLOAD)).resolves.toBeUndefined();
    });
  });

  describe("email path", () => {
    const ADMIN_EMAIL = "admin@example.com";

    beforeEach(() => {
      vi.stubEnv("ALERT_WEBHOOK_URL", "");
      vi.stubEnv("ADMIN_ALERT_EMAIL", ADMIN_EMAIL);
      vi.stubEnv("SMTP_USER", "smtp-user@example.com");
      vi.stubEnv("SMTP_PASS", "smtp-secret");
    });

    it("calls nodemailer createTransport", async () => {
      await sendGhostStripeAlert(PAYLOAD);

      expect(nodemailer.createTransport).toHaveBeenCalledOnce();
    });

    it("sends an email to the admin address", async () => {
      await sendGhostStripeAlert(PAYLOAD);

      const transport = nodemailer.createTransport();
      expect(transport.sendMail).toHaveBeenCalledOnce();
      const mailArgs = (transport.sendMail as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as { to: string; subject: string; html: string };
      expect(mailArgs.to).toBe(ADMIN_EMAIL);
    });

    it("uses the ACTION REQUIRED subject line", async () => {
      await sendGhostStripeAlert(PAYLOAD);

      const transport = nodemailer.createTransport();
      const mailArgs = (transport.sendMail as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as { to: string; subject: string; html: string };
      expect(mailArgs.subject).toContain("ACTION REQUIRED");
      expect(mailArgs.subject).toContain("Stripe rollback failed");
    });

    it("embeds stripeCustomerId in the email HTML", async () => {
      await sendGhostStripeAlert(PAYLOAD);

      const transport = nodemailer.createTransport();
      const mailArgs = (transport.sendMail as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as { to: string; subject: string; html: string };
      expect(mailArgs.html).toContain(PAYLOAD.stripeCustomerId!);
    });

    it("embeds stripeSubscriptionId in the email HTML", async () => {
      await sendGhostStripeAlert(PAYLOAD);

      const transport = nodemailer.createTransport();
      const mailArgs = (transport.sendMail as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as { to: string; subject: string; html: string };
      expect(mailArgs.html).toContain(PAYLOAD.stripeSubscriptionId!);
    });

    it("includes rollback error messages in the email HTML", async () => {
      await sendGhostStripeAlert(PAYLOAD_WITH_ERRORS);

      const transport = nodemailer.createTransport();
      const mailArgs = (transport.sendMail as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as { to: string; subject: string; html: string };
      expect(mailArgs.html).toContain("Subscription cancel network timeout");
      expect(mailArgs.html).toContain("Customer delete rate-limited");
    });

    it("does not throw when SMTP credentials are missing", async () => {
      vi.stubEnv("SMTP_USER", "");
      vi.stubEnv("SMTP_PASS", "");

      await expect(sendGhostStripeAlert(PAYLOAD)).resolves.toBeUndefined();
    });
  });

  describe("both Slack and email paths together", () => {
    const WEBHOOK_URL = "https://hooks.slack.com/services/BOTH/TEST";
    const ADMIN_EMAIL = "ops@example.com";

    beforeEach(() => {
      vi.stubEnv("ALERT_WEBHOOK_URL", WEBHOOK_URL);
      vi.stubEnv("ADMIN_ALERT_EMAIL", ADMIN_EMAIL);
      vi.stubEnv("SMTP_USER", "smtp@example.com");
      vi.stubEnv("SMTP_PASS", "pass");
    });

    it("fires both Slack webhook and email in parallel", async () => {
      const fetchMock = makeOkFetch();
      vi.stubGlobal("fetch", fetchMock);

      await sendGhostStripeAlert(PAYLOAD);

      expect(fetchMock).toHaveBeenCalledOnce();
      const transport = nodemailer.createTransport();
      expect(transport.sendMail).toHaveBeenCalledOnce();
    });

    it("carries correct IDs on both channels when both are set", async () => {
      const fetchMock = makeOkFetch();
      vi.stubGlobal("fetch", fetchMock);

      await sendGhostStripeAlert(PAYLOAD_WITH_ERRORS);

      const slackBody = JSON.parse(
        fetchMock.mock.calls[0][1].body as string,
      ) as { text: string };
      expect(slackBody.text).toContain(PAYLOAD_WITH_ERRORS.stripeCustomerId);
      expect(slackBody.text).toContain(PAYLOAD_WITH_ERRORS.stripeSubscriptionId);

      const transport = nodemailer.createTransport();
      const mailArgs = (transport.sendMail as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as { html: string };
      expect(mailArgs.html).toContain(PAYLOAD_WITH_ERRORS.stripeCustomerId!);
      expect(mailArgs.html).toContain(PAYLOAD_WITH_ERRORS.stripeSubscriptionId!);
    });

    it("still resolves even if one channel fails", async () => {
      vi.stubGlobal("fetch", makeBadFetch(503));
      vi.stubEnv("SMTP_USER", "");

      await expect(sendGhostStripeAlert(PAYLOAD)).resolves.toBeUndefined();
    });
  });

  describe("DB-failure signup scenario (rollbackStripe simulation)", () => {
    it("is called with correct IDs when Stripe rollback fails after DB error", async () => {
      vi.stubEnv("ALERT_WEBHOOK_URL", "https://hooks.slack.com/services/SIM/TEST");
      vi.stubEnv("ADMIN_ALERT_EMAIL", "");
      const fetchMock = makeOkFetch();
      vi.stubGlobal("fetch", fetchMock);

      const stripeCustomerId = "cus_SIMULATED";
      const stripeSubscriptionId = "sub_SIMULATED";
      const subCancelError = new Error("Network error cancelling subscription");
      const customerDeleteError = new Error("Customer not found in Stripe");

      await sendGhostStripeAlert({
        stripeCustomerId,
        stripeSubscriptionId,
        subCancelError,
        customerDeleteError,
      });

      expect(fetchMock).toHaveBeenCalledOnce();
      const body = JSON.parse(fetchMock.mock.calls[0][1].body as string) as {
        text: string;
      };
      expect(body.text).toContain(stripeCustomerId);
      expect(body.text).toContain(stripeSubscriptionId);
      expect(body.text).toContain(subCancelError.message);
      expect(body.text).toContain(customerDeleteError.message);
    });

    it("handles the case where only the customer was created before DB failure", async () => {
      vi.stubEnv("ALERT_WEBHOOK_URL", "https://hooks.slack.com/services/SIM/TEST2");
      vi.stubEnv("ADMIN_ALERT_EMAIL", "");
      const fetchMock = makeOkFetch();
      vi.stubGlobal("fetch", fetchMock);

      const stripeCustomerId = "cus_PARTIAL";

      await sendGhostStripeAlert({
        stripeCustomerId,
        stripeSubscriptionId: null,
        customerDeleteError: new Error("Delete failed"),
      });

      expect(fetchMock).toHaveBeenCalledOnce();
      const body = JSON.parse(fetchMock.mock.calls[0][1].body as string) as {
        text: string;
      };
      expect(body.text).toContain(stripeCustomerId);
      expect(body.text).toContain("none");
    });

    it("sends email with correct IDs when DB fails and email alert is configured", async () => {
      vi.stubEnv("ALERT_WEBHOOK_URL", "");
      vi.stubEnv("ADMIN_ALERT_EMAIL", "oncall@example.com");
      vi.stubEnv("SMTP_USER", "alerts@example.com");
      vi.stubEnv("SMTP_PASS", "s3cr3t");

      const stripeCustomerId = "cus_DBFAIL";
      const stripeSubscriptionId = "sub_DBFAIL";

      await sendGhostStripeAlert({
        stripeCustomerId,
        stripeSubscriptionId,
        subCancelError: new Error("timeout"),
      });

      const transport = nodemailer.createTransport();
      expect(transport.sendMail).toHaveBeenCalledOnce();
      const mailArgs = (transport.sendMail as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as { to: string; html: string };
      expect(mailArgs.to).toBe("oncall@example.com");
      expect(mailArgs.html).toContain(stripeCustomerId);
      expect(mailArgs.html).toContain(stripeSubscriptionId);
    });
  });
});

describe("sendOrphanPermanentFailureAlert", () => {
  let sendOrphanPermanentFailureAlert: (
    payload: OrphanPermanentFailurePayload,
  ) => Promise<void>;
  let nodemailer: typeof import("nodemailer");

  beforeEach(async () => {
    vi.resetModules();
    ({ sendOrphanPermanentFailureAlert } = await import("../lib/alerts"));
    nodemailer = (await import("nodemailer")).default as unknown as typeof import("nodemailer");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  describe("when no alert destination is configured", () => {
    it("returns without throwing and logs a warning", async () => {
      vi.stubEnv("ALERT_WEBHOOK_URL", "");
      vi.stubEnv("ADMIN_ALERT_EMAIL", "");
      const fetchMock = makeOkFetch();
      vi.stubGlobal("fetch", fetchMock);

      const pino = (await import("pino")).default as ReturnType<typeof vi.fn>;
      const loggerInstance = pino() as { warn: ReturnType<typeof vi.fn> };

      await expect(
        sendOrphanPermanentFailureAlert(ORPHAN_PAYLOAD),
      ).resolves.toBeUndefined();
      expect(fetchMock).not.toHaveBeenCalled();
      expect(loggerInstance.warn).toHaveBeenCalledOnce();
    });
  });

  describe("Slack webhook path", () => {
    const WEBHOOK_URL = "https://hooks.slack.com/services/ORPHAN/TEST";

    beforeEach(() => {
      vi.stubEnv("ALERT_WEBHOOK_URL", WEBHOOK_URL);
      vi.stubEnv("ADMIN_ALERT_EMAIL", "");
    });

    it("POSTs to the Slack webhook URL with JSON content-type", async () => {
      const fetchMock = makeOkFetch();
      vi.stubGlobal("fetch", fetchMock);

      await sendOrphanPermanentFailureAlert(ORPHAN_PAYLOAD);

      expect(fetchMock).toHaveBeenCalledOnce();
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(WEBHOOK_URL);
      expect(init.method).toBe("POST");
      expect((init.headers as Record<string, string>)["Content-Type"]).toBe(
        "application/json",
      );
    });

    it("includes stripeCustomerId in the Slack message body", async () => {
      const fetchMock = makeOkFetch();
      vi.stubGlobal("fetch", fetchMock);

      await sendOrphanPermanentFailureAlert(ORPHAN_PAYLOAD);

      const body = JSON.parse(fetchMock.mock.calls[0][1].body as string) as {
        text: string;
      };
      expect(body.text).toContain(ORPHAN_PAYLOAD.stripeCustomerId);
    });

    it("includes stripeSubscriptionId in the Slack message body", async () => {
      const fetchMock = makeOkFetch();
      vi.stubGlobal("fetch", fetchMock);

      await sendOrphanPermanentFailureAlert(ORPHAN_PAYLOAD);

      const body = JSON.parse(fetchMock.mock.calls[0][1].body as string) as {
        text: string;
      };
      expect(body.text).toContain(ORPHAN_PAYLOAD.stripeSubscriptionId);
    });

    it("includes retry count in the Slack message body", async () => {
      const fetchMock = makeOkFetch();
      vi.stubGlobal("fetch", fetchMock);

      await sendOrphanPermanentFailureAlert(ORPHAN_PAYLOAD);

      const body = JSON.parse(fetchMock.mock.calls[0][1].body as string) as {
        text: string;
      };
      expect(body.text).toContain(String(ORPHAN_PAYLOAD.retryCount));
    });

    it("includes lastError in the Slack message body", async () => {
      const fetchMock = makeOkFetch();
      vi.stubGlobal("fetch", fetchMock);

      await sendOrphanPermanentFailureAlert(ORPHAN_PAYLOAD);

      const body = JSON.parse(fetchMock.mock.calls[0][1].body as string) as {
        text: string;
      };
      expect(body.text).toContain(ORPHAN_PAYLOAD.lastError!);
    });

    it("handles null IDs gracefully in the Slack body", async () => {
      const fetchMock = makeOkFetch();
      vi.stubGlobal("fetch", fetchMock);

      await sendOrphanPermanentFailureAlert(ORPHAN_PAYLOAD_NULL_IDS);

      const body = JSON.parse(fetchMock.mock.calls[0][1].body as string) as {
        text: string;
      };
      expect(body.text).toContain("none");
    });

    it("does not throw when the Slack webhook returns a non-ok status", async () => {
      vi.stubGlobal("fetch", makeBadFetch(503));

      await expect(
        sendOrphanPermanentFailureAlert(ORPHAN_PAYLOAD),
      ).resolves.toBeUndefined();
    });
  });

  describe("email path", () => {
    const ADMIN_EMAIL = "dev@example.com";

    beforeEach(() => {
      vi.stubEnv("ALERT_WEBHOOK_URL", "");
      vi.stubEnv("ADMIN_ALERT_EMAIL", ADMIN_EMAIL);
      vi.stubEnv("SMTP_USER", "smtp-user@example.com");
      vi.stubEnv("SMTP_PASS", "smtp-secret");
    });

    it("sends an email to the configured developer address", async () => {
      await sendOrphanPermanentFailureAlert(ORPHAN_PAYLOAD);

      const transport = nodemailer.createTransport();
      expect(transport.sendMail).toHaveBeenCalledOnce();
      const mailArgs = (transport.sendMail as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as { to: string; subject: string; html: string };
      expect(mailArgs.to).toBe(ADMIN_EMAIL);
    });

    it("uses an ACTION REQUIRED subject line mentioning orphan cleanup", async () => {
      await sendOrphanPermanentFailureAlert(ORPHAN_PAYLOAD);

      const transport = nodemailer.createTransport();
      const mailArgs = (transport.sendMail as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as { to: string; subject: string; html: string };
      expect(mailArgs.subject).toContain("ACTION REQUIRED");
      expect(mailArgs.subject).toContain("orphan");
    });

    it("embeds stripeCustomerId in the email HTML", async () => {
      await sendOrphanPermanentFailureAlert(ORPHAN_PAYLOAD);

      const transport = nodemailer.createTransport();
      const mailArgs = (transport.sendMail as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as { html: string };
      expect(mailArgs.html).toContain(ORPHAN_PAYLOAD.stripeCustomerId!);
    });

    it("embeds stripeSubscriptionId in the email HTML", async () => {
      await sendOrphanPermanentFailureAlert(ORPHAN_PAYLOAD);

      const transport = nodemailer.createTransport();
      const mailArgs = (transport.sendMail as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as { html: string };
      expect(mailArgs.html).toContain(ORPHAN_PAYLOAD.stripeSubscriptionId!);
    });

    it("embeds retry count in the email HTML", async () => {
      await sendOrphanPermanentFailureAlert(ORPHAN_PAYLOAD);

      const transport = nodemailer.createTransport();
      const mailArgs = (transport.sendMail as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as { html: string };
      expect(mailArgs.html).toContain(String(ORPHAN_PAYLOAD.retryCount));
    });

    it("embeds lastError in the email HTML", async () => {
      await sendOrphanPermanentFailureAlert(ORPHAN_PAYLOAD);

      const transport = nodemailer.createTransport();
      const mailArgs = (transport.sendMail as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as { html: string };
      expect(mailArgs.html).toContain(ORPHAN_PAYLOAD.lastError!);
    });

    it("renders gracefully when lastError is null", async () => {
      await sendOrphanPermanentFailureAlert(ORPHAN_PAYLOAD_NO_ERROR);

      const transport = nodemailer.createTransport();
      expect(transport.sendMail).toHaveBeenCalledOnce();
      const mailArgs = (transport.sendMail as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as { html: string };
      expect(mailArgs.html).toContain(ORPHAN_PAYLOAD_NO_ERROR.stripeCustomerId!);
    });

    it("does not throw when SMTP credentials are missing", async () => {
      vi.stubEnv("SMTP_USER", "");
      vi.stubEnv("SMTP_PASS", "");

      await expect(
        sendOrphanPermanentFailureAlert(ORPHAN_PAYLOAD),
      ).resolves.toBeUndefined();
    });
  });

  describe("both Slack and email paths together", () => {
    const WEBHOOK_URL = "https://hooks.slack.com/services/ORPHAN/BOTH";
    const ADMIN_EMAIL = "oncall@example.com";

    beforeEach(() => {
      vi.stubEnv("ALERT_WEBHOOK_URL", WEBHOOK_URL);
      vi.stubEnv("ADMIN_ALERT_EMAIL", ADMIN_EMAIL);
      vi.stubEnv("SMTP_USER", "smtp@example.com");
      vi.stubEnv("SMTP_PASS", "pass");
    });

    it("fires both Slack webhook and email in parallel", async () => {
      const fetchMock = makeOkFetch();
      vi.stubGlobal("fetch", fetchMock);

      await sendOrphanPermanentFailureAlert(ORPHAN_PAYLOAD);

      expect(fetchMock).toHaveBeenCalledOnce();
      const transport = nodemailer.createTransport();
      expect(transport.sendMail).toHaveBeenCalledOnce();
    });

    it("carries correct IDs on both channels", async () => {
      const fetchMock = makeOkFetch();
      vi.stubGlobal("fetch", fetchMock);

      await sendOrphanPermanentFailureAlert(ORPHAN_PAYLOAD);

      const slackBody = JSON.parse(
        fetchMock.mock.calls[0][1].body as string,
      ) as { text: string };
      expect(slackBody.text).toContain(ORPHAN_PAYLOAD.stripeCustomerId);
      expect(slackBody.text).toContain(ORPHAN_PAYLOAD.stripeSubscriptionId);

      const transport = nodemailer.createTransport();
      const mailArgs = (transport.sendMail as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as { html: string };
      expect(mailArgs.html).toContain(ORPHAN_PAYLOAD.stripeCustomerId!);
      expect(mailArgs.html).toContain(ORPHAN_PAYLOAD.stripeSubscriptionId!);
    });

    it("resolves even if one channel fails", async () => {
      vi.stubGlobal("fetch", makeBadFetch(503));
      vi.stubEnv("SMTP_USER", "");

      await expect(
        sendOrphanPermanentFailureAlert(ORPHAN_PAYLOAD),
      ).resolves.toBeUndefined();
    });
  });
});
