import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { GhostStripeAlertPayload, OrphanPermanentFailurePayload } from "../lib/alerts";

vi.mock("pino", () => {
  const warn = vi.fn();
  const error = vi.fn();
  const pinoFn = vi.fn(() => ({ warn, error }));
  return { default: pinoFn };
});

vi.mock("../lib/email", () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
}));

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

function makeFailThenSucceedFetch(failCount = 1, status = 500) {
  let calls = 0;
  return vi.fn().mockImplementation(() => {
    calls++;
    if (calls <= failCount) {
      return Promise.resolve({ ok: false, status });
    }
    return Promise.resolve({ ok: true, status: 200 });
  });
}

describe("sendGhostStripeAlert", () => {
  let sendGhostStripeAlert: (payload: GhostStripeAlertPayload) => Promise<void>;
  let sendEmail: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.resetModules();
    ({ sendGhostStripeAlert } = await import("../lib/alerts"));
    sendEmail = (await import("../lib/email")).sendEmail as ReturnType<typeof vi.fn>;
    sendEmail.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetAllMocks();
    vi.useRealTimers();
  });

  describe("when no alert destination is configured", () => {
    it("does not throw and returns silently", async () => {
      vi.stubEnv("ALERT_WEBHOOK_URL", "");
      vi.stubEnv("ADMIN_ALERT_EMAIL", "");
      const fetchMock = makeOkFetch();
      vi.stubGlobal("fetch", fetchMock);

      await expect(sendGhostStripeAlert(PAYLOAD)).resolves.toBeUndefined();
      expect(fetchMock).not.toHaveBeenCalled();
      expect(sendEmail).not.toHaveBeenCalled();
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
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
      vi.stubGlobal("fetch", makeBadFetch(400));

      const promise = sendGhostStripeAlert(PAYLOAD);
      await vi.runAllTimersAsync();

      await expect(promise).resolves.toBeUndefined();
    });
  });

  describe("email path", () => {
    const ADMIN_EMAIL = "admin@example.com";

    beforeEach(() => {
      vi.stubEnv("ALERT_WEBHOOK_URL", "");
      vi.stubEnv("ADMIN_ALERT_EMAIL", ADMIN_EMAIL);
    });

    it("calls sendEmail once", async () => {
      await sendGhostStripeAlert(PAYLOAD);

      expect(sendEmail).toHaveBeenCalledOnce();
    });

    it("sends an email to the admin address", async () => {
      await sendGhostStripeAlert(PAYLOAD);

      const callArgs = sendEmail.mock.calls[0][0] as {
        to: string;
        subject: string;
        html: string;
      };
      expect(callArgs.to).toBe(ADMIN_EMAIL);
    });

    it("uses the ACTION REQUIRED subject line", async () => {
      await sendGhostStripeAlert(PAYLOAD);

      const callArgs = sendEmail.mock.calls[0][0] as { subject: string };
      expect(callArgs.subject).toContain("ACTION REQUIRED");
      expect(callArgs.subject).toContain("Stripe rollback failed");
    });

    it("embeds stripeCustomerId in the email HTML", async () => {
      await sendGhostStripeAlert(PAYLOAD);

      const callArgs = sendEmail.mock.calls[0][0] as { html: string };
      expect(callArgs.html).toContain(PAYLOAD.stripeCustomerId!);
    });

    it("embeds stripeSubscriptionId in the email HTML", async () => {
      await sendGhostStripeAlert(PAYLOAD);

      const callArgs = sendEmail.mock.calls[0][0] as { html: string };
      expect(callArgs.html).toContain(PAYLOAD.stripeSubscriptionId!);
    });

    it("includes rollback error messages in the email HTML", async () => {
      await sendGhostStripeAlert(PAYLOAD_WITH_ERRORS);

      const callArgs = sendEmail.mock.calls[0][0] as { html: string };
      expect(callArgs.html).toContain("Subscription cancel network timeout");
      expect(callArgs.html).toContain("Customer delete rate-limited");
    });

    it("does not throw when sendEmail rejects", async () => {
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
      sendEmail.mockRejectedValue(new Error("SMTP timeout"));

      const promise = sendGhostStripeAlert(PAYLOAD);
      await vi.runAllTimersAsync();

      await expect(promise).resolves.toBeUndefined();
    });
  });

  describe("both Slack and email paths together", () => {
    const WEBHOOK_URL = "https://hooks.slack.com/services/BOTH/TEST";
    const ADMIN_EMAIL = "ops@example.com";

    beforeEach(() => {
      vi.stubEnv("ALERT_WEBHOOK_URL", WEBHOOK_URL);
      vi.stubEnv("ADMIN_ALERT_EMAIL", ADMIN_EMAIL);
    });

    it("fires both Slack webhook and email in parallel", async () => {
      const fetchMock = makeOkFetch();
      vi.stubGlobal("fetch", fetchMock);

      await sendGhostStripeAlert(PAYLOAD);

      expect(fetchMock).toHaveBeenCalledOnce();
      expect(sendEmail).toHaveBeenCalledOnce();
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

      const mailArgs = sendEmail.mock.calls[0][0] as { html: string };
      expect(mailArgs.html).toContain(PAYLOAD_WITH_ERRORS.stripeCustomerId!);
      expect(mailArgs.html).toContain(PAYLOAD_WITH_ERRORS.stripeSubscriptionId!);
    });

    it("still resolves even if one channel fails", async () => {
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
      vi.stubGlobal("fetch", makeBadFetch(503));
      sendEmail.mockRejectedValue(new Error("SMTP unavailable"));

      const promise = sendGhostStripeAlert(PAYLOAD);
      await vi.runAllTimersAsync();

      await expect(promise).resolves.toBeUndefined();
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

      const stripeCustomerId = "cus_DBFAIL";
      const stripeSubscriptionId = "sub_DBFAIL";

      await sendGhostStripeAlert({
        stripeCustomerId,
        stripeSubscriptionId,
        subCancelError: new Error("timeout"),
      });

      expect(sendEmail).toHaveBeenCalledOnce();
      const callArgs = sendEmail.mock.calls[0][0] as { to: string; html: string };
      expect(callArgs.to).toBe("oncall@example.com");
      expect(callArgs.html).toContain(stripeCustomerId);
      expect(callArgs.html).toContain(stripeSubscriptionId);
    });
  });

  describe("retry behavior", () => {
    const WEBHOOK_URL = "https://hooks.slack.com/services/RETRY/TEST";

    beforeEach(() => {
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
      vi.stubEnv("ALERT_WEBHOOK_URL", WEBHOOK_URL);
      vi.stubEnv("ADMIN_ALERT_EMAIL", "");
    });

    it("succeeds on the 2nd attempt when the first Slack call fails", async () => {
      const fetchMock = makeFailThenSucceedFetch(1);
      vi.stubGlobal("fetch", fetchMock);

      const promise = sendGhostStripeAlert(PAYLOAD);
      await vi.runAllTimersAsync();
      await expect(promise).resolves.toBeUndefined();

      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("succeeds on the 3rd attempt when the first two Slack calls fail", async () => {
      const fetchMock = makeFailThenSucceedFetch(2);
      vi.stubGlobal("fetch", fetchMock);

      const promise = sendGhostStripeAlert(PAYLOAD);
      await vi.runAllTimersAsync();
      await expect(promise).resolves.toBeUndefined();

      expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it("gives up and resolves after 3 failed attempts without throwing", async () => {
      const fetchMock = makeBadFetch(503);
      vi.stubGlobal("fetch", fetchMock);

      const promise = sendGhostStripeAlert(PAYLOAD);
      await vi.runAllTimersAsync();
      await expect(promise).resolves.toBeUndefined();

      expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it("logs an error with both err and payload after all retries are exhausted", async () => {
      vi.stubGlobal("fetch", makeBadFetch(500));

      const promise = sendGhostStripeAlert(PAYLOAD);
      await vi.runAllTimersAsync();
      await promise;

      const pino = (await import("pino")).default;
      const mockLogger = pino({} as never);
      expect(mockLogger.error).toHaveBeenCalled();
      const [logObj] = (mockLogger.error as ReturnType<typeof vi.fn>).mock.calls[0] as [
        Record<string, unknown>,
        string,
      ];
      expect(logObj).toHaveProperty("err");
      expect(logObj).toHaveProperty("payload");
      expect(logObj.payload).toMatchObject({
        stripeCustomerId: PAYLOAD.stripeCustomerId,
        stripeSubscriptionId: PAYLOAD.stripeSubscriptionId,
      });
    });

    it("uses exponential back-off delays between attempts", async () => {
      vi.stubGlobal("fetch", makeBadFetch(500));

      const setTimeoutSpy = vi.spyOn(global, "setTimeout");

      const promise = sendGhostStripeAlert(PAYLOAD);
      await vi.runAllTimersAsync();
      await promise;

      const delayArgs = (setTimeoutSpy.mock.calls as Array<[unknown, number]>)
        .map((call) => call[1])
        .filter((ms) => ms >= 1000);

      expect(delayArgs).toEqual(expect.arrayContaining([1000, 2000]));
    });

    it("retries email channel independently — succeeds on 2nd attempt", async () => {
      vi.stubEnv("ALERT_WEBHOOK_URL", "");
      vi.stubEnv("ADMIN_ALERT_EMAIL", "ops@example.com");

      sendEmail
        .mockRejectedValueOnce(new Error("SMTP timeout attempt 1"))
        .mockResolvedValue(undefined);

      const promise = sendGhostStripeAlert(PAYLOAD);
      await vi.runAllTimersAsync();
      await expect(promise).resolves.toBeUndefined();

      expect(sendEmail).toHaveBeenCalledTimes(2);
    });

    it("retries email channel — gives up after 3 failed attempts without throwing", async () => {
      vi.stubEnv("ALERT_WEBHOOK_URL", "");
      vi.stubEnv("ADMIN_ALERT_EMAIL", "ops@example.com");

      sendEmail.mockRejectedValue(new Error("Persistent SMTP failure"));

      const promise = sendGhostStripeAlert(PAYLOAD);
      await vi.runAllTimersAsync();
      await expect(promise).resolves.toBeUndefined();

      expect(sendEmail).toHaveBeenCalledTimes(3);
    });

    it("does not make more than 3 attempts per channel", async () => {
      vi.stubGlobal("fetch", makeBadFetch(500));

      const promise = sendGhostStripeAlert(PAYLOAD);
      await vi.runAllTimersAsync();
      await promise;

      const fetchMock = vi.mocked(global.fetch as ReturnType<typeof vi.fn>);
      expect(fetchMock.mock.calls.length).toBeLessThanOrEqual(3);
    });
  });
});

describe("sendOrphanPermanentFailureAlert", () => {
  let sendOrphanPermanentFailureAlert: (
    payload: OrphanPermanentFailurePayload,
  ) => Promise<void>;
  let sendEmail: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.resetModules();
    ({ sendOrphanPermanentFailureAlert } = await import("../lib/alerts"));
    sendEmail = (await import("../lib/email")).sendEmail as ReturnType<typeof vi.fn>;
    sendEmail.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetAllMocks();
    vi.useRealTimers();
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
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
      vi.stubGlobal("fetch", makeBadFetch(503));

      const promise = sendOrphanPermanentFailureAlert(ORPHAN_PAYLOAD);
      await vi.runAllTimersAsync();

      await expect(promise).resolves.toBeUndefined();
    });
  });

  describe("email path", () => {
    const ADMIN_EMAIL = "dev@example.com";

    beforeEach(() => {
      vi.stubEnv("ALERT_WEBHOOK_URL", "");
      vi.stubEnv("ADMIN_ALERT_EMAIL", ADMIN_EMAIL);
    });

    it("sends an email to the configured developer address", async () => {
      await sendOrphanPermanentFailureAlert(ORPHAN_PAYLOAD);

      expect(sendEmail).toHaveBeenCalledOnce();
      const callArgs = sendEmail.mock.calls[0][0] as { to: string; subject: string; html: string };
      expect(callArgs.to).toBe(ADMIN_EMAIL);
    });

    it("uses an ACTION REQUIRED subject line mentioning orphan cleanup", async () => {
      await sendOrphanPermanentFailureAlert(ORPHAN_PAYLOAD);

      const callArgs = sendEmail.mock.calls[0][0] as { subject: string };
      expect(callArgs.subject).toContain("ACTION REQUIRED");
      expect(callArgs.subject).toContain("orphan");
    });

    it("embeds stripeCustomerId in the email HTML", async () => {
      await sendOrphanPermanentFailureAlert(ORPHAN_PAYLOAD);

      const callArgs = sendEmail.mock.calls[0][0] as { html: string };
      expect(callArgs.html).toContain(ORPHAN_PAYLOAD.stripeCustomerId!);
    });

    it("embeds stripeSubscriptionId in the email HTML", async () => {
      await sendOrphanPermanentFailureAlert(ORPHAN_PAYLOAD);

      const callArgs = sendEmail.mock.calls[0][0] as { html: string };
      expect(callArgs.html).toContain(ORPHAN_PAYLOAD.stripeSubscriptionId!);
    });

    it("embeds retry count in the email HTML", async () => {
      await sendOrphanPermanentFailureAlert(ORPHAN_PAYLOAD);

      const callArgs = sendEmail.mock.calls[0][0] as { html: string };
      expect(callArgs.html).toContain(String(ORPHAN_PAYLOAD.retryCount));
    });

    it("embeds lastError in the email HTML", async () => {
      await sendOrphanPermanentFailureAlert(ORPHAN_PAYLOAD);

      const callArgs = sendEmail.mock.calls[0][0] as { html: string };
      expect(callArgs.html).toContain(ORPHAN_PAYLOAD.lastError!);
    });

    it("renders gracefully when lastError is null", async () => {
      await sendOrphanPermanentFailureAlert(ORPHAN_PAYLOAD_NO_ERROR);

      expect(sendEmail).toHaveBeenCalledOnce();
      const callArgs = sendEmail.mock.calls[0][0] as { html: string };
      expect(callArgs.html).toContain(ORPHAN_PAYLOAD_NO_ERROR.stripeCustomerId!);
    });

    it("does not throw when sendEmail rejects", async () => {
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
      sendEmail.mockRejectedValue(new Error("SMTP failure"));

      const promise = sendOrphanPermanentFailureAlert(ORPHAN_PAYLOAD);
      await vi.runAllTimersAsync();

      await expect(promise).resolves.toBeUndefined();
    });
  });

  describe("both Slack and email paths together", () => {
    const WEBHOOK_URL = "https://hooks.slack.com/services/ORPHAN/BOTH";
    const ADMIN_EMAIL = "oncall@example.com";

    beforeEach(() => {
      vi.stubEnv("ALERT_WEBHOOK_URL", WEBHOOK_URL);
      vi.stubEnv("ADMIN_ALERT_EMAIL", ADMIN_EMAIL);
    });

    it("fires both Slack webhook and email in parallel", async () => {
      const fetchMock = makeOkFetch();
      vi.stubGlobal("fetch", fetchMock);

      await sendOrphanPermanentFailureAlert(ORPHAN_PAYLOAD);

      expect(fetchMock).toHaveBeenCalledOnce();
      expect(sendEmail).toHaveBeenCalledOnce();
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

      const mailArgs = sendEmail.mock.calls[0][0] as { html: string };
      expect(mailArgs.html).toContain(ORPHAN_PAYLOAD.stripeCustomerId!);
      expect(mailArgs.html).toContain(ORPHAN_PAYLOAD.stripeSubscriptionId!);
    });

    it("resolves even if one channel fails", async () => {
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
      vi.stubGlobal("fetch", makeBadFetch(503));
      sendEmail.mockRejectedValue(new Error("SMTP unavailable"));

      const promise = sendOrphanPermanentFailureAlert(ORPHAN_PAYLOAD);
      await vi.runAllTimersAsync();

      await expect(promise).resolves.toBeUndefined();
    });
  });
});
