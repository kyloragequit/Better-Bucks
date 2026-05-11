import { sendEmail } from "./email";
import { storage } from "../storage";
import { logger } from "./logger";
import type { User } from "@workspace/db";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatLockExpiry(lockedUntil: Date | null): string {
  if (!lockedUntil) return "unknown";
  return lockedUntil.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

/**
 * Send a lockout alert email to all approved admins (prime_admin + admin) of
 * the locked employee's organization, or to a dedicated security inbox if one
 * has been configured. Fire-and-forget: errors are logged but never propagate
 * to the caller so a mail failure never blocks the auth flow.
 */
export async function notifyAdminsOfAccountLockout(lockedUser: User): Promise<void> {
  if (lockedUser.role !== "employee") return;
  if (!lockedUser.organizationId) return;
  try {
    const org = await storage.getOrganization(lockedUser.organizationId);

    let adminEmails: string[];
    if (org?.securityAlertEmail) {
      adminEmails = [org.securityAlertEmail];
    } else {
      const orgUsers = await storage.getUsersByOrganization(lockedUser.organizationId);
      adminEmails = [
        ...new Set(
          orgUsers
            .filter(
              (u) =>
                (u.role === "prime_admin" || u.role === "admin") &&
                u.email &&
                u.status === "approved",
            )
            .map((u) => u.email as string),
        ),
      ];
    }
    if (!adminEmails.length) return;

    const employeeName = escapeHtml(lockedUser.fullName || lockedUser.username);
    const employeeUsername = escapeHtml(lockedUser.username);
    const expiryStr = escapeHtml(formatLockExpiry(lockedUser.lockedUntil ? new Date(lockedUser.lockedUntil) : null));

    const subject = `[Better Bucks] Account locked — ${lockedUser.fullName || lockedUser.username}`;

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;">
        <div style="text-align:center;padding:20px 0 12px;">
          <img src="https://betterbucks.net/logo.png" alt="Better Bucks" width="64" height="64" style="display:block;margin:0 auto;" />
        </div>
        <h3 style="color:#162A4A;margin-top:0;text-align:center;">Employee Account Locked</h3>
        <p style="color:#374151;font-size:14px;">An employee account has been <strong>automatically locked</strong> after too many failed login attempts. This may indicate the employee is having trouble signing in, or that someone is attempting unauthorized access.</p>
        <table style="border-collapse:collapse;width:100%;background:#F8FAFC;border-radius:8px;overflow:hidden;margin:16px 0;">
          <tr>
            <td style="padding:8px 12px;color:#6B7280;font-weight:500;white-space:nowrap;font-size:13px;">Employee Name</td>
            <td style="padding:8px 12px;color:#111827;font-size:13px;">${employeeName}</td>
          </tr>
          <tr style="background:#fff;">
            <td style="padding:8px 12px;color:#6B7280;font-weight:500;white-space:nowrap;font-size:13px;">Username</td>
            <td style="padding:8px 12px;color:#111827;font-size:13px;">${employeeUsername}</td>
          </tr>
          <tr>
            <td style="padding:8px 12px;color:#6B7280;font-weight:500;white-space:nowrap;font-size:13px;">Lock Expires</td>
            <td style="padding:8px 12px;color:#111827;font-size:13px;">${expiryStr}</td>
          </tr>
        </table>
        <p style="color:#6B7280;font-size:13px;">If you recognize this employee and they need immediate access, you can unlock their account from the <strong>Locked Accounts</strong> section in your admin dashboard.</p>
        <p style="margin-top:16px;color:#9CA3AF;font-size:11px;">Sent automatically by Better Bucks.</p>
      </div>
    `;

    await Promise.all(
      adminEmails.map((email) =>
        sendEmail({ to: email, subject, html, appendFooter: false }).catch(
          (err: unknown) => {
            logger.warn(
              `[LockoutNotify] Failed to email ${email}: ${err instanceof Error ? err.message : String(err)}`,
            );
          },
        ),
      ),
    );

    logger.info(
      `[LockoutNotify] Notified ${adminEmails.length} admin(s) of lockout for user ${lockedUser.id}`,
    );
  } catch (err: unknown) {
    logger.warn(
      `[LockoutNotify] Error sending lockout notifications for user ${lockedUser.id}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
