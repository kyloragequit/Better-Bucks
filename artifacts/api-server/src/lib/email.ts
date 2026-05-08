import nodemailer from "nodemailer";
import { ReplitConnectors } from "@replit/connectors-sdk";
import { logger } from "./logger";

const DEFAULT_FROM = "miles.chase@betterbucks.net";

let cachedTransporter: nodemailer.Transporter | null = null;
let cachedSmtpKey = "";
let gmailConnectors: ReplitConnectors | null = null;

export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  return `${local.slice(0, 2)}***@${domain}`;
}

function getGmailConnectors(): ReplitConnectors {
  if (!gmailConnectors) gmailConnectors = new ReplitConnectors();
  return gmailConnectors;
}

function getTransporter(): nodemailer.Transporter | null {
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  if (!smtpUser || !smtpPass) return null;
  const smtpHost = process.env.SMTP_HOST || "smtp.gmail.com";
  const smtpPort = parseInt(process.env.SMTP_PORT || "587");
  const key = `${smtpHost}:${smtpPort}:${smtpUser}`;
  if (cachedTransporter && cachedSmtpKey === key) return cachedTransporter;
  cachedTransporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: { user: smtpUser, pass: smtpPass },
    pool: true,
    maxConnections: 3,
    maxMessages: 100,
  });
  cachedSmtpKey = key;
  return cachedTransporter;
}

function buildRfc2822Message({ from, to, subject, html, text }: {
  from: string;
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}): string {
  const toStr = Array.isArray(to) ? to.join(", ") : to;
  const boundary = `bb_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const encodedSubject = `=?UTF-8?B?${Buffer.from(subject).toString("base64")}?=`;
  const b64Lines = (data: string): string => data.match(/.{1,76}/g)?.join("\r\n") ?? data;

  const lines: string[] = [
    `From: "Better Bucks" <${from}>`,
    `To: ${toStr}`,
    `Subject: ${encodedSubject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    ``,
  ];

  if (text) {
    lines.push(
      `--${boundary}`,
      `Content-Type: text/plain; charset=UTF-8`,
      `Content-Transfer-Encoding: base64`,
      ``,
      b64Lines(Buffer.from(text).toString("base64")),
      ``,
    );
  }

  lines.push(
    `--${boundary}`,
    `Content-Type: text/html; charset=UTF-8`,
    `Content-Transfer-Encoding: base64`,
    ``,
    b64Lines(Buffer.from(html).toString("base64")),
    ``,
    `--${boundary}--`,
  );

  return lines.join("\r\n");
}

/**
 * Send an email using the Gmail API (OAuth, better deliverability) with an
 * automatic SMTP fallback. Both transports use the same credentials already
 * configured in the environment, so there is a single place to update them.
 *
 * The `from` parameter defaults to the canonical Better Bucks sending address.
 * An auto-generated tracking footer is appended to user-facing messages.
 * Set `appendFooter: false` for operational/admin alert emails so they arrive
 * without the marketing footer.
 */
export async function sendEmail({
  to,
  subject,
  html,
  text,
  from = DEFAULT_FROM,
  appendFooter = true,
}: {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
  appendFooter?: boolean;
}): Promise<void> {
  const recipients = (Array.isArray(to) ? to : [to]).map(r => String(r).trim().toLowerCase());
  const isToSelf = recipients.length === 1 && recipients[0] === DEFAULT_FROM;
  const addFooter = appendFooter && !isToSelf;
  const finalHtml = addFooter
    ? `${html}\n<div style="text-align:center;color:#bdbdbd;font-size:10px;font-family:Arial,sans-serif;margin-top:16px;">[auto-generated5738]</div>`
    : html;
  const finalText = text
    ? (addFooter ? `${text}\n\n[auto-generated5738]` : text)
    : undefined;

  // Primary: Gmail API via OAuth (better deliverability, shows in Sent folder)
  try {
    const connectors = getGmailConnectors();
    const raw = buildRfc2822Message({ from, to, subject, html: finalHtml, text: finalText });
    const base64url = Buffer.from(raw).toString("base64url");
    const resp = await connectors.proxy("google-mail", "/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ raw: base64url }),
    });
    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`Gmail API ${resp.status}: ${errText.slice(0, 300)}`);
    }
    logger.info(`[Email] Sent "${subject}" to ${maskEmail(Array.isArray(to) ? to[0] : to)} via Gmail API`);
    return;
  } catch (gmailErr: unknown) {
    const gmailMsg = gmailErr instanceof Error ? gmailErr.message : String(gmailErr);
    logger.warn(`[Email] Gmail API failed, falling back to SMTP: ${gmailMsg}`);
  }

  // Fallback: SMTP
  const smtpUser = process.env.SMTP_USER;
  if (!smtpUser || !process.env.SMTP_PASS) {
    throw new Error(`Email not configured — Gmail API unavailable and SMTP credentials missing. Cannot send "${subject}".`);
  }
  const transporter = getTransporter();
  if (!transporter) throw new Error("Email not configured");
  try {
    await transporter.sendMail({
      from: `"Better Bucks" <${smtpUser}>`,
      to,
      subject,
      html: finalHtml,
      ...(finalText ? { text: finalText } : {}),
    });
    logger.info(`[Email] Sent "${subject}" to ${maskEmail(Array.isArray(to) ? to[0] : to)} via SMTP fallback`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`[Email] SMTP fallback failed for "${subject}" to ${maskEmail(Array.isArray(to) ? to[0] : to)}: ${msg}`);
    cachedTransporter = null;
    cachedSmtpKey = "";
    throw err instanceof Error ? err : new Error(msg);
  }
}
