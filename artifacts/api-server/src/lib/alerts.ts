import nodemailer from "nodemailer";
import { logger } from "./logger";

export interface GhostStripeAlertPayload {
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  subCancelError?: unknown;
  customerDeleteError?: unknown;
}

function buildSlackBody(payload: GhostStripeAlertPayload): string {
  const lines = [
    ":rotating_light: *Stripe rollback failed — ghost objects require manual cleanup*",
    "",
    `*Customer ID:* \`${payload.stripeCustomerId ?? "none"}\``,
    `*Subscription ID:* \`${payload.stripeSubscriptionId ?? "none"}\``,
  ];

  if (payload.subCancelError) {
    const msg =
      payload.subCancelError instanceof Error
        ? payload.subCancelError.message
        : String(payload.subCancelError);
    lines.push(`*Subscription cancel error:* ${msg}`);
  }

  if (payload.customerDeleteError) {
    const msg =
      payload.customerDeleteError instanceof Error
        ? payload.customerDeleteError.message
        : String(payload.customerDeleteError);
    lines.push(`*Customer delete error:* ${msg}`);
  }

  lines.push("", "Search these IDs in the Stripe dashboard to clean up manually.");

  return lines.join("\n");
}

function buildEmailHtml(payload: GhostStripeAlertPayload): string {
  const row = (label: string, value: string) =>
    `<tr><td style="padding:8px 12px;font-weight:600;background:#f9fafb;border:1px solid #e5e7eb;white-space:nowrap">${label}</td><td style="padding:8px 12px;font-family:monospace;background:#fff;border:1px solid #e5e7eb">${value}</td></tr>`;

  const subCancelMsg =
    payload.subCancelError instanceof Error
      ? payload.subCancelError.message
      : payload.subCancelError
        ? String(payload.subCancelError)
        : null;

  const customerDeleteMsg =
    payload.customerDeleteError instanceof Error
      ? payload.customerDeleteError.message
      : payload.customerDeleteError
        ? String(payload.customerDeleteError)
        : null;

  return `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f5f7fb;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:560px;margin:24px auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
    <div style="background:#b91c1c;color:#fff;padding:16px 22px;font-weight:700;font-size:16px;">
      ⚠️ Better Bucks — Stripe Rollback Failed
    </div>
    <div style="padding:20px 22px;color:#111827;">
      <p style="margin:0 0 14px;font-size:15px;">
        A Stripe rollback failed after a database error during mobile signup.
        The following objects may be orphaned and require manual cleanup in the Stripe dashboard.
      </p>
      <table style="border-collapse:collapse;width:100%;margin-bottom:16px;">
        ${row("Customer ID", payload.stripeCustomerId ?? "(none)")}
        ${row("Subscription ID", payload.stripeSubscriptionId ?? "(none)")}
        ${subCancelMsg ? row("Subscription cancel error", subCancelMsg) : ""}
        ${customerDeleteMsg ? row("Customer delete error", customerDeleteMsg) : ""}
      </table>
      <p style="margin:0;font-size:13px;color:#6b7280;">
        Search these IDs in the
        <a href="https://dashboard.stripe.com/customers" style="color:#162A4A;">Stripe dashboard</a>
        to verify and clean up manually.
      </p>
    </div>
  </div>
</body></html>`;
}

async function sendSlackAlert(webhookUrl: string, payload: GhostStripeAlertPayload): Promise<void> {
  const body = buildSlackBody(payload);
  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: body }),
  });
  if (!response.ok) {
    throw new Error(`Slack webhook returned ${response.status}`);
  }
}

async function sendEmailAlert(adminEmail: string, payload: GhostStripeAlertPayload): Promise<void> {
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  if (!smtpUser || !smtpPass) {
    throw new Error("ADMIN_ALERT_EMAIL is set but SMTP_USER/SMTP_PASS are not configured");
  }

  const smtpHost = process.env.SMTP_HOST ?? "smtp.gmail.com";
  const smtpPort = parseInt(process.env.SMTP_PORT ?? "587", 10);

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: { user: smtpUser, pass: smtpPass },
  });

  await transporter.sendMail({
    from: `"Better Bucks Alerts" <${smtpUser}>`,
    to: adminEmail,
    subject: "[Better Bucks] ACTION REQUIRED: Stripe rollback failed — orphaned customer/subscription",
    html: buildEmailHtml(payload),
  });
}

/**
 * Fire-and-forget alert sent when rollbackStripe fails, leaving orphaned
 * Stripe objects. Respects ALERT_WEBHOOK_URL (Slack) and ADMIN_ALERT_EMAIL.
 * Errors are caught and logged so they never bubble up to the caller.
 */
export async function sendGhostStripeAlert(payload: GhostStripeAlertPayload): Promise<void> {
  const webhookUrl = process.env.ALERT_WEBHOOK_URL;
  const adminEmail = process.env.ADMIN_ALERT_EMAIL;

  if (!webhookUrl && !adminEmail) {
    logger.warn(
      "Ghost Stripe objects detected but no alert destination configured. " +
        "Set ALERT_WEBHOOK_URL or ADMIN_ALERT_EMAIL to receive notifications.",
    );
    return;
  }

  const results = await Promise.allSettled([
    webhookUrl ? sendSlackAlert(webhookUrl, payload) : Promise.resolve(),
    adminEmail ? sendEmailAlert(adminEmail, payload) : Promise.resolve(),
  ]);

  for (const result of results) {
    if (result.status === "rejected") {
      logger.error(
        { err: result.reason },
        "Failed to send ghost Stripe alert notification",
      );
    }
  }
}
