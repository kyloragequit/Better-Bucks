
import type { Express, Request, Response, NextFunction } from "express";
import { seedDemoOrg, createSessionDemoOrg, deleteSessionDemoOrg, cleanupStaleDemoOrgs } from "./seedDemo";
import type { Server } from "http";
import { setupAuth, hashPassword, verifyPassword, isCaptchaRequired, verifyTurnstileToken, invalidateUserCache } from "./auth";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import nodemailer from "nodemailer";
import { ensureStripeReady } from "./stripeLazy";
import { getUncachableStripeClient, getStripePublishableKey } from "./stripeClient";

async function getStripeClient() {
  return getUncachableStripeClient();
}

async function getStripePubKey() {
  return getStripePublishableKey();
}
import { sql, eq, and, gte, lte, gt, lt, inArray, isNull } from "drizzle-orm";
import { db } from "./db";
import { organizations, users, infoRequests, transactions, orders, customItemTransactions } from "@shared/schema";
import cron from "node-cron";
import type { User } from "@shared/schema";

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

function sanitizeUser(user: any): any {
  if (!user) return user;
  const { password, lastPlainPassword, passwordResetToken, passwordResetExpiry, ...safe } = user;
  return safe;
}

function sanitizeUsers(users: any[]): any[] {
  return users.map(sanitizeUser);
}

function getAppBaseUrl(req: any): string {
  if (process.env.APP_URL) return process.env.APP_URL;
  const host = req.get("host") || req.hostname || "betterbucks.net";
  return `https://${host}`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  return `${local.slice(0, 2)}***@${domain}`;
}

function maskPhone(phone: string): string {
  return phone.slice(0, -4).replace(/\d/g, "*") + phone.slice(-4);
}

// ── Background bulk-import job store ─────────────────────────────────────────
type ImportJobRow = { fullName: string; username: string; role?: string; email?: string; password?: string; departmentName?: string; managerName?: string };
type ImportJobResult = { row: number; username: string; fullName: string; success: boolean; error?: string };
type ImportJob = {
  id: string;
  orgId: number;
  initiatorEmail: string | null;
  initiatorName: string;
  status: "running" | "done" | "cancelled";
  total: number;
  processed: number;
  imported: number;
  results: ImportJobResult[];
  cancelRequested: boolean;
  createdAt: number;
};
const importJobs = new Map<string, ImportJob>();
// Prune completed jobs older than 2 hours every 30 min
setInterval(() => {
  const cutoff = Date.now() - 2 * 60 * 60 * 1000;
  for (const [id, job] of importJobs) {
    if (job.status !== "running" && job.createdAt < cutoff) importJobs.delete(id);
  }
}, 30 * 60 * 1000).unref();

let cachedTransporter: any = null;
let cachedSmtpKey = "";

function getTransporter() {
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

async function sendEmail({ to, subject, html, text }: { to: string; subject: string; html: string; text?: string }): Promise<void> {
  const smtpUser = process.env.SMTP_USER;
  if (!smtpUser || !process.env.SMTP_PASS) {
    const msg = `SMTP not configured — SMTP_USER / SMTP_PASS env vars are missing. Cannot send "${subject}" to ${maskEmail(typeof to === "string" ? to : String(to))}.`;
    console.error(`[Email] ${msg}`);
    throw new Error(msg);
  }
  const transporter = getTransporter();
  if (!transporter) throw new Error("SMTP not configured");
  try {
    await transporter.sendMail({
      from: `"Better Bucks" <${smtpUser}>`,
      to,
      subject,
      html,
      ...(text ? { text } : {}),
    });
    console.log(`[Email] Sent "${subject}" to ${maskEmail(to)}`);
  } catch (err: any) {
    console.error(`[Email] Failed to send "${subject}" to ${maskEmail(to)}:`, err?.message ?? err);
    cachedTransporter = null;
    cachedSmtpKey = "";
    throw err;
  }
}

const ADMIN_NOTIFY_EMAIL = "miles.chase@betterbucks.net";
const EMAIL_LOGO_URL = "https://betterbucks.net/logo.png";
const emailLogoHeader = `<div style="text-align:center;padding:20px 0 12px;"><img src="${EMAIL_LOGO_URL}" alt="Better Bucks" width="64" height="64" style="display:block;margin:0 auto;" /></div>`;

async function getOrgPrimeAdminEmail(organizationId: number): Promise<string | null> {
  const orgUsers = await storage.getUsersByOrganization(organizationId);
  const primeAdmin = orgUsers.find(u => u.role === "prime_admin" && u.email);
  return primeAdmin?.email ?? null;
}

async function getOrgAdminEmails(organizationId: number): Promise<string[]> {
  const orgUsers = await storage.getUsersByOrganization(organizationId);
  const emails = orgUsers
    .filter(u => (u.role === "prime_admin" || u.role === "admin") && u.email && u.status === "approved")
    .map(u => u.email as string);
  return [...new Set(emails)];
}

async function getOrgPrimeAdminEmails(organizationId: number): Promise<string[]> {
  const orgUsers = await storage.getUsersByOrganization(organizationId);
  const emails = orgUsers
    .filter(u => u.role === "prime_admin" && u.email && u.status === "approved")
    .map(u => u.email as string);
  return [...new Set(emails)];
}

async function notifyAllPrimeAdmins(organizationId: number, subject: string, details: Record<string, string>): Promise<void> {
  const emails = await getOrgPrimeAdminEmails(organizationId);
  await Promise.all(emails.map(email => notifyAdmin(email, subject, details).catch(() => {})));
}

interface BillingEmailParams {
  to: string;
  invoiceNumber: string;
  invoiceDate: string;
  planName: string;
  subtotal: string;
  taxAmount: string;
  taxLabel: string;
  total: string;
  periodStart: string;
  periodEnd: string;
  paymentMethod: string;
  organizationName: string;
  invoicePdfUrl?: string;
  isTrialEnd?: boolean;
}

async function sendBillingReceiptEmail(params: BillingEmailParams): Promise<void> {
  const {
    to, invoiceNumber, invoiceDate, planName, subtotal, taxAmount, taxLabel,
    total, periodStart, periodEnd, paymentMethod, organizationName,
    invoicePdfUrl, isTrialEnd,
  } = params;

  const trialBanner = isTrialEnd
    ? `<div style="background:#fef3c7;border:1px solid #f59e0b;border-radius:8px;padding:12px 16px;margin-bottom:20px;text-align:center;">
        <p style="margin:0;font-size:14px;color:#92400e;font-weight:600;">🎉 Your free trial has ended — your subscription is now active!</p>
      </div>`
    : "";

  const pdfButton = invoicePdfUrl
    ? `<div style="text-align:center;margin-top:20px;">
        <a href="${invoicePdfUrl}" style="display:inline-block;background:#162A4A;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">Download Invoice PDF</a>
      </div>`
    : "";

  const html = `
    <div style="font-family:'Inter',Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#ffffff;">
      ${emailLogoHeader}
      
      <h2 style="text-align:center;color:#162A4A;font-size:22px;font-weight:700;margin:16px 0 4px;">Payment Receipt</h2>
      <p style="text-align:center;color:#64748b;font-size:13px;margin:0 0 24px;">Invoice #${escapeHtml(invoiceNumber)} • ${escapeHtml(invoiceDate)}</p>

      ${trialBanner}

      <div style="background:#F0F4F8;border-radius:12px;padding:20px;margin-bottom:20px;">
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:6px 0;color:#64748b;font-size:13px;">Organization</td>
            <td style="padding:6px 0;text-align:right;font-weight:600;color:#162A4A;font-size:13px;">${escapeHtml(organizationName)}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#64748b;font-size:13px;">Plan</td>
            <td style="padding:6px 0;text-align:right;font-weight:600;color:#162A4A;font-size:13px;">${escapeHtml(planName)}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#64748b;font-size:13px;">Billing Period</td>
            <td style="padding:6px 0;text-align:right;font-weight:600;color:#162A4A;font-size:13px;">${escapeHtml(periodStart)} — ${escapeHtml(periodEnd)}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#64748b;font-size:13px;">Payment Method</td>
            <td style="padding:6px 0;text-align:right;font-weight:600;color:#162A4A;font-size:13px;">${escapeHtml(paymentMethod)}</td>
          </tr>
        </table>
      </div>

      <div style="background:#ffffff;border:1px solid #dde3ea;border-radius:12px;padding:20px;">
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:8px 0;color:#162A4A;font-size:14px;">${escapeHtml(planName)}</td>
            <td style="padding:8px 0;text-align:right;color:#162A4A;font-size:14px;">${escapeHtml(subtotal)}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#64748b;font-size:13px;">${escapeHtml(taxLabel)}</td>
            <td style="padding:8px 0;text-align:right;color:#64748b;font-size:13px;">${escapeHtml(taxAmount)}</td>
          </tr>
          <tr>
            <td colspan="2" style="border-top:1px solid #dde3ea;padding:0;"></td>
          </tr>
          <tr>
            <td style="padding:12px 0 4px;color:#162A4A;font-size:16px;font-weight:700;">Total Charged</td>
            <td style="padding:12px 0 4px;text-align:right;color:#4E9F3D;font-size:20px;font-weight:700;">${escapeHtml(total)}</td>
          </tr>
        </table>
      </div>

      ${pdfButton}

      <div style="margin-top:24px;padding-top:20px;border-top:1px solid #dde3ea;text-align:center;">
        <p style="color:#64748b;font-size:12px;margin:0 0 4px;">Questions about your bill? Reply to this email or contact us at</p>
        <p style="margin:0;"><a href="mailto:miles.chase@betterbucks.net" style="color:#4E9F3D;font-size:12px;text-decoration:none;">miles.chase@betterbucks.net</a></p>
        <p style="color:#94a3b8;font-size:11px;margin:12px 0 0;">Better Bucks, LLC — Employee Incentive Platform</p>
      </div>
    </div>
  `;

  const text = `Better Bucks — Payment Receipt\n\nInvoice: ${invoiceNumber}\nDate: ${invoiceDate}\nOrganization: ${organizationName}\nPlan: ${planName}\nPeriod: ${periodStart} — ${periodEnd}\nSubtotal: ${subtotal}\nTax: ${taxAmount}\nTotal Charged: ${total}\nPayment: ${paymentMethod}\n\nQuestions? Contact miles.chase@betterbucks.net`;

  await sendEmail({ to, subject: `Better Bucks — Payment Receipt (${invoiceDate})`, html, text });
}

async function notifyAdmin(to: string, subject: string, details: Record<string, string>): Promise<void> {
  const rows = Object.entries(details)
    .map(([k, v]) => `<tr><td style="padding:4px 8px;color:#666;font-weight:500;white-space:nowrap">${escapeHtml(k)}</td><td style="padding:4px 8px;">${escapeHtml(v || "—")}</td></tr>`)
    .join("");
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;">
      ${emailLogoHeader}
      <h3 style="color:#4E9F3D;margin-top:0;text-align:center;">${escapeHtml(subject)}</h3>
      <table style="border-collapse:collapse;width:100%;background:#F8FAFC;border-radius:8px;overflow:hidden;">
        ${rows}
      </table>
      <p style="margin-top:16px;color:#999;font-size:12px;">Sent automatically by Better Bucks.</p>
    </div>
  `;
  try {
    await sendEmail({ to, subject: `[Better Bucks] ${subject}`, html });
  } catch (err) {
    console.error("[Admin Notify] Failed:", err);
  }
}

async function sendVerificationEmail(email: string, code: string, fullName: string): Promise<void> {
  try {
    await sendEmail({
      to: email,
      subject: "Verify your email - Better Bucks",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
          ${emailLogoHeader}
          <p>Hi ${escapeHtml(fullName)},</p>
          <p>Your verification code is:</p>
          <div style="background: #EEF4FB; padding: 16px; border-radius: 8px; text-align: center; font-size: 32px; letter-spacing: 6px; font-weight: bold; color: #162A4A;">${code}</div>
          <p style="margin-top: 16px; color: #666;">Enter this code in the app to verify your email address.</p>
        </div>
      `,
    });
  } catch (err) {
    console.error(`[Email Verification] Failed to send to ${maskEmail(email)}:`, err);
  }
}

async function sendVerificationCode(email: string | null | undefined, phone: string | null | undefined, code: string, fullName: string): Promise<void> {
  if (email) {
    await sendVerificationEmail(email, code, fullName);
  }
  if (phone) {
    await sendVerificationSMS(phone, code);
  }
}

async function sendVerificationSMS(phone: string, code: string): Promise<void> {
  try {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_PHONE_NUMBER;
    if (!accountSid || !authToken || !fromNumber) {
      console.log(`[SMS Verification] Twilio not configured. Code for ${maskPhone(phone)}: [REDACTED]`);
      return;
    }
    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": "Basic " + Buffer.from(`${accountSid}:${authToken}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        To: phone,
        From: fromNumber,
        Body: `Your Better Bucks verification code is: ${code}`,
      }),
    });
    if (!response.ok) {
      const errData = await response.text();
      console.error(`[SMS Verification] Twilio error:`, errData);
      return;
    }
    console.log(`[SMS Verification] Sent to ${maskPhone(phone)}`);
  } catch (err) {
    console.error(`[SMS Verification] Failed to send to ${maskPhone(phone)}:`, err);
  }
}

const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const blogImageDir = path.join(process.cwd(), "client/public/blog-images");
if (!fs.existsSync(blogImageDir)) fs.mkdirSync(blogImageDir, { recursive: true });

let _upload: any = null;
async function getUpload() {
  if (!_upload) {
    const multer = (await import("multer")).default;
    _upload = multer({
      storage: multer.diskStorage({
        destination: (_req: any, _file: any, cb: any) => cb(null, uploadDir),
        filename: (_req: any, file: any, cb: any) => cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${path.extname(file.originalname)}`),
      }),
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_req: any, file: any, cb: any) => {
        const allowed = /jpeg|jpg|png|gif|webp|pdf|doc|docx|xls|xlsx|csv|txt|rtf/;
        const ext = allowed.test(path.extname(file.originalname).toLowerCase());
        cb(null, ext);
      },
    });
  }
  return _upload;
}

async function seedBlogPosts() {
  const existing = await storage.getAllBlogPosts();
  if (existing.length > 0) return;
  await storage.createBlogPost({
    title: "How Much Companies Spend on Employee Motivation and Recognition Programs",
    slug: "employee-motivation-recognition-program-costs",
    excerpt: "Companies spend thousands of dollars each year trying to motivate employees through recognition and reward programs. But how much time and money do these programs actually require—and how can businesses manage them more efficiently?",
    content: `Organizations already spend significant resources trying to motivate employees, with research showing that companies invest roughly $200–$350 per employee each year in recognition programs according to HR Cloud's employee rewards budget research
. Many organizations also allocate around 1% of total payroll to recognition and incentive initiatives, a benchmark highlighted in studies on workplace recognition and engagement such as Josh Bersin's research on employee recognition
. At the same time, managing these programs consumes substantial time—HR professionals spend up to 40% of their workweek on administrative tasks related to tracking programs, approvals, and internal processes according to research summarized by Inspirus on the cost of manual recognition management
. This creates a major inefficiency: companies are already investing large amounts of money in employee motivation while also losing valuable time managing the process manually. Better Bucks solves both problems simultaneously. By centralizing reward tracking, automating recognition workflows, and allowing managers to instantly reward employees for safety, attendance, and exceptional performance, Better Bucks removes hours of administrative work while ensuring recognition is timely and consistent. The result is a system that helps organizations get more value from the money they already spend on motivation while saving managers and HR teams dozens of hours every year.`,
    imageUrl: "/blog-images/1772722237267-95a8nux3tcp.jpg",
    authorName: "Better Bucks Team",
    authorPhotoUrl: null,
    sources: JSON.stringify([
      { title: "Guide to Employee Rewards and Recognition Budgets", source: "HR Cloud", url: "https://www.hrcloud.com/blog/guide-to-employee-rewards-and-recognition-budget", topic: "Employee recognition budget benchmarks and spending per employee" },
      { title: "New Research Unlocks the Secret of Employee Recognition", source: "Forbes (Josh Bersin)", url: "https://www.forbes.com/sites/joshbersin/2012/06/13/new-research-unlocks-the-secret-of-employee-recognition/", topic: "Recognition program spending and its impact on engagement" },
      { title: "The Cost of Manual Employee Recognition Programs", source: "Inspirus", url: "https://www.inspirus.com/blog/cost-of-manual-employee-recognition/", topic: "Administrative time and inefficiencies in manual recognition systems" }
    ]),
    imageAlt: "A stressed HR professional",
    imageSource: "Photo by Vitaly Gariev on Unsplash",
    publishedAt: new Date("2026-03-05T14:48:03.432Z"),
  });
}

// ── Monthly Report Generator ─────────────────────────────────────────────────
async function generateMonthlyReport(orgId: number, year: number, month: number) {
  const from = new Date(year, month - 1, 1);
  const to = new Date(year, month, 0, 23, 59, 59, 999);
  const org = await storage.getOrganization(orgId);
  const orgUsers = await storage.getUsersByOrganization(orgId);
  const userIds = orgUsers.map(u => u.id);

  const allTxRows = userIds.length > 0
    ? await db.select({ t: transactions, u: users }).from(transactions).leftJoin(users, eq(transactions.userId, users.id))
        .where(and(inArray(transactions.userId, userIds), gte(transactions.createdAt, from), lte(transactions.createdAt, to)))
    : [];

  const monthOrders = userIds.length > 0
    ? await db.select({ o: orders, u: users }).from(orders).leftJoin(users, eq(orders.userId, users.id))
        .where(and(inArray(orders.userId, userIds), gte(orders.createdAt, from), lte(orders.createdAt, to)))
    : [];

  const [categoryStats, budgetUsed, orgDepts] = await Promise.all([
    storage.getCategoryStats(orgId, from, to),
    storage.getMonthlyBudgetUsed(orgId, year, month),
    storage.getDepartmentsByOrganization(orgId),
  ]);

  const totalAwarded = allTxRows.filter(r => r.t.amount > 0).reduce((s, r) => s + r.t.amount, 0);
  const totalSpent = allTxRows.filter(r => r.t.amount < 0).reduce((s, r) => s + Math.abs(r.t.amount), 0);
  const totalOrders = monthOrders.length;

  const topEmployees: { userId: number; name: string; received: number }[] = [];
  const empMap: Record<number, number> = {};
  const activeEmployeeIds = new Set<number>();
  for (const { t, u } of allTxRows) {
    if (t.amount > 0 && u) {
      empMap[t.userId] = (empMap[t.userId] || 0) + t.amount;
      activeEmployeeIds.add(t.userId);
    }
  }
  for (const [uid, bucks] of Object.entries(empMap)) {
    const u = orgUsers.find(x => x.id === parseInt(uid));
    if (u) topEmployees.push({ userId: parseInt(uid), name: u.fullName, received: bucks });
  }
  topEmployees.sort((a, b) => b.received - a.received);

  // Department breakdown: credits and debits per department
  const deptStatMap: Record<string, { deptId: number | null; deptName: string | null; credited: number; debited: number }> = {};
  for (const { t, u } of allTxRows) {
    const deptId = u?.departmentId ?? null;
    const deptName = deptId ? (orgDepts.find(d => d.id === deptId)?.name ?? "Unknown") : "No Department";
    const key = String(deptId ?? "none");
    if (!deptStatMap[key]) deptStatMap[key] = { deptId, deptName, credited: 0, debited: 0 };
    if (t.amount > 0) deptStatMap[key].credited += t.amount;
    else deptStatMap[key].debited += Math.abs(t.amount);
  }
  const departmentStats = Object.values(deptStatMap).sort((a, b) => b.credited - a.credited);

  // Daily spending breakdown for chart
  const dailySpending: { date: string; credited: number; debited: number }[] = [];
  const dailyMap: Record<string, { credited: number; debited: number }> = {};
  for (const { t } of allTxRows) {
    const day = t.createdAt.toISOString().slice(0, 10);
    if (!dailyMap[day]) dailyMap[day] = { credited: 0, debited: 0 };
    if (t.amount > 0) dailyMap[day].credited += t.amount;
    else dailyMap[day].debited += Math.abs(t.amount);
  }
  const cursor = new Date(from);
  while (cursor <= to) {
    const day = cursor.toISOString().slice(0, 10);
    dailySpending.push({
      date: day,
      credited: dailyMap[day]?.credited ?? 0,
      debited: dailyMap[day]?.debited ?? 0,
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  const conversionRate = org?.bucksPerDollar ?? 100;

  const reportData = {
    orgName: org?.name ?? "",
    year,
    month,
    totalAwarded,
    totalSpent,
    totalOrders,
    budgetUsed,
    monthlyBudgetBucks: org?.monthlyBudgetBucks ?? 0,
    conversionRate,
    dailySpending,
    categoryStats,
    departmentStats,
    topEmployees: topEmployees.slice(0, 10),
    activeEmployees: activeEmployeeIds.size,
    txCount: allTxRows.length,
  };

  return storage.createMonthlyReport({ orgId, year, month, reportData });
}

// ── Weekly Report ─────────────────────────────────────────────────────────────
async function sendWeeklyReportForOrg(orgId: number, orgName: string, recipients: string | string[]): Promise<void> {
  const recipientList = Array.isArray(recipients) ? recipients : [recipients];
  if (recipientList.length === 0) return;
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - 7);
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(now);
  weekEnd.setHours(23, 59, 59, 999);

  const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const weekLabel = `${fmt(weekStart)} – ${fmt(now)}`;

  const org = await storage.getOrganization(orgId);
  const itemName = org?.customItemName || null;

  const orgUsers = await storage.getUsersByOrganization(orgId);
  const userIds = orgUsers.map(u => u.id);
  if (userIds.length === 0) return;

  const allTxRows = await db
    .select({ t: transactions, u: users })
    .from(transactions)
    .leftJoin(users, eq(transactions.userId, users.id))
    .where(and(inArray(transactions.userId, userIds), gte(transactions.createdAt, weekStart), lte(transactions.createdAt, weekEnd)));

  const weekTx = allTxRows;

  // Category breakdown for the week
  const weekCategoryStats = await storage.getCategoryStats(orgId, weekStart, weekEnd);
  const monthlyBudgetUsed = await storage.getMonthlyBudgetUsed(orgId, now.getFullYear(), now.getMonth() + 1);
  const monthlyBudget = org?.monthlyBudgetBucks ?? 0;

  const weekItemTx = itemName ? await storage.getCustomItemTransactionsByOrg(orgId, weekStart) : [];
  const weekOrders = await db
    .select({ o: orders, u: users })
    .from(orders)
    .leftJoin(users, eq(orders.userId, users.id))
    .where(and(inArray(orders.userId, userIds), gte(orders.createdAt, weekStart)));

  const employeeIds = new Set(orgUsers.filter(u => u.role === "employee").map(u => u.id));
  const adminIds = new Set(orgUsers.filter(u => u.role === "admin" || u.role === "prime_admin").map(u => u.id));

  let totalBucksAwarded = 0;
  let totalBucksSpent = 0;
  let adminGiven = 0;
  let employeeSpent = 0;

  for (const { t } of weekTx) {
    if (t.amount > 0 && t.performedBy && adminIds.has(t.performedBy)) adminGiven += t.amount;
    if (t.amount < 0 && employeeIds.has(t.userId)) employeeSpent += Math.abs(t.amount);
    if (t.amount > 0) totalBucksAwarded += t.amount;
    if (t.amount < 0) totalBucksSpent += Math.abs(t.amount);
  }

  const totalOrders = weekOrders.length;
  const pendingOrders = weekOrders.filter(r => r.o.status === "pending").length;
  const approvedOrders = weekOrders.filter(r => r.o.status === "approved" || r.o.status === "completed").length;

  const txRows = weekTx.slice(0, 50).map(({ t, u }) => `
    <tr style="border-bottom:1px solid #F1F5F9;">
      <td style="padding:8px 12px;font-size:13px;color:#374151;">${t.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</td>
      <td style="padding:8px 12px;font-size:13px;color:#374151;">${escapeHtml(u?.fullName || "—")}</td>
      <td style="padding:8px 12px;font-size:13px;color:#6B7280;max-width:260px;">${escapeHtml(t.reason)}</td>
      <td style="padding:8px 12px;font-size:13px;font-weight:600;text-align:right;color:${t.amount >= 0 ? "#4E9F3D" : "#ef4444"};">${t.amount >= 0 ? "+" : ""}${t.amount.toLocaleString()}</td>
    </tr>`).join("");

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
<body style="margin:0;padding:0;background:#F8FAFC;font-family:Arial,sans-serif;">
<div style="max-width:640px;margin:32px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

  <!-- Header -->
  <div style="background:#162A4A;padding:28px 32px;text-align:center;">
    <img src="${EMAIL_LOGO_URL}" alt="Better Bucks" width="56" height="56" style="display:block;margin:0 auto 10px;" />
    <p style="color:#8BA3C2;margin:6px 0 0;font-size:14px;">Weekly Activity Report · ${weekLabel}</p>
  </div>

  <!-- Org name -->
  <div style="padding:20px 32px 0;">
    <p style="margin:0;font-size:15px;color:#6B7280;">Organization: <strong style="color:#162A4A;">${escapeHtml(orgName)}</strong></p>
  </div>

  <!-- Stats grid -->
  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;padding:20px 32px;">
    <div style="background:#F0FDF4;border-radius:8px;padding:16px;text-align:center;">
      <p style="margin:0;font-size:24px;font-weight:700;color:#4E9F3D;">${totalBucksAwarded.toLocaleString()}</p>
      <p style="margin:4px 0 0;font-size:12px;color:#6B7280;">Bucks Awarded</p>
    </div>
    <div style="background:#FEF2F2;border-radius:8px;padding:16px;text-align:center;">
      <p style="margin:0;font-size:24px;font-weight:700;color:#ef4444;">${totalBucksSpent.toLocaleString()}</p>
      <p style="margin:4px 0 0;font-size:12px;color:#6B7280;">Bucks Spent</p>
    </div>
    <div style="background:#EFF6FF;border-radius:8px;padding:16px;text-align:center;">
      <p style="margin:0;font-size:24px;font-weight:700;color:#3B82F6;">${totalOrders}</p>
      <p style="margin:4px 0 0;font-size:12px;color:#6B7280;">Store Orders</p>
    </div>
  </div>

  <!-- Spend breakdown -->
  <div style="padding:0 32px 20px;">
    <div style="background:#F8FAFC;border-radius:8px;padding:16px;">
      <h3 style="margin:0 0 12px;font-size:13px;font-weight:700;color:#162A4A;text-transform:uppercase;letter-spacing:0.5px;">Weekly Spend Breakdown</h3>
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="padding:6px 0;font-size:13px;color:#6B7280;">Bucks given by admins</td>
          <td style="padding:6px 0;font-size:13px;font-weight:600;text-align:right;color:#4E9F3D;">+${adminGiven.toLocaleString()}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;font-size:13px;color:#6B7280;">Bucks spent by employees (store)</td>
          <td style="padding:6px 0;font-size:13px;font-weight:600;text-align:right;color:#ef4444;">-${employeeSpent.toLocaleString()}</td>
        </tr>
        <tr style="border-top:1px solid #E2E8F0;">
          <td style="padding:8px 0 4px;font-size:13px;font-weight:700;color:#162A4A;">Store Orders</td>
          <td style="padding:8px 0 4px;font-size:13px;font-weight:600;text-align:right;color:#162A4A;">${pendingOrders} pending · ${approvedOrders} approved</td>
        </tr>
      </table>
    </div>
  </div>

  <!-- Monthly Budget Progress -->
  ${monthlyBudget > 0 ? `
  <div style="padding:0 32px 20px;">
    <div style="background:#F8FAFC;border-radius:8px;padding:16px;">
      <h3 style="margin:0 0 10px;font-size:13px;font-weight:700;color:#162A4A;text-transform:uppercase;letter-spacing:0.5px;">Monthly Budget Progress</h3>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
        <span style="font-size:13px;color:#6B7280;">${monthlyBudgetUsed.toLocaleString()} / ${monthlyBudget.toLocaleString()} Bucks used</span>
        <span style="font-size:13px;font-weight:700;color:${monthlyBudgetUsed / monthlyBudget >= 0.9 ? "#ef4444" : monthlyBudgetUsed / monthlyBudget >= 0.7 ? "#f59e0b" : "#4E9F3D"};">${Math.round((monthlyBudgetUsed / monthlyBudget) * 100)}%</span>
      </div>
      <div style="background:#E2E8F0;border-radius:99px;height:8px;overflow:hidden;">
        <div style="background:${monthlyBudgetUsed / monthlyBudget >= 0.9 ? "#ef4444" : monthlyBudgetUsed / monthlyBudget >= 0.7 ? "#f59e0b" : "#4E9F3D"};height:8px;border-radius:99px;width:${Math.min(Math.round((monthlyBudgetUsed / monthlyBudget) * 100), 100)}%;"></div>
      </div>
    </div>
  </div>` : ""}

  <!-- Category Breakdown -->
  ${weekCategoryStats.length > 0 ? (() => {
    const totalCatBucks = weekCategoryStats.reduce((s, c) => s + c.totalBucks, 0);
    return `
  <div style="padding:0 32px 20px;">
    <div style="background:#F8FAFC;border-radius:8px;padding:16px;">
      <h3 style="margin:0 0 12px;font-size:13px;font-weight:700;color:#162A4A;text-transform:uppercase;letter-spacing:0.5px;">Bucks by Category This Week</h3>
      ${weekCategoryStats.slice(0, 6).map(c => {
        const pct = totalCatBucks > 0 ? Math.round((c.totalBucks / totalCatBucks) * 100) : 0;
        const name = c.categoryName ?? "Uncategorized";
        const color = c.categoryColor ?? "#9CA3AF";
        return `<div style="margin-bottom:8px;">
          <div style="display:flex;justify-content:space-between;margin-bottom:3px;">
            <span style="font-size:12px;color:#374151;">${escapeHtml(name)}</span>
            <span style="font-size:12px;font-weight:600;color:#374151;">${c.totalBucks.toLocaleString()} (${pct}%)</span>
          </div>
          <div style="background:#E2E8F0;border-radius:99px;height:6px;overflow:hidden;">
            <div style="background:${color};height:6px;border-radius:99px;width:${pct}%;"></div>
          </div>
        </div>`;
      }).join("")}
    </div>
  </div>`;
  })() : ""}

  <!-- Transaction list -->
  ${weekTx.length > 0 ? `
  <div style="padding:0 32px 24px;">
    <h3 style="margin:0 0 12px;font-size:13px;font-weight:700;color:#162A4A;text-transform:uppercase;letter-spacing:0.5px;">All Transactions This Week${weekTx.length > 50 ? " (first 50)" : ""}</h3>
    <table style="width:100%;border-collapse:collapse;border:1px solid #E2E8F0;border-radius:8px;overflow:hidden;">
      <thead>
        <tr style="background:#F8FAFC;">
          <th style="padding:8px 12px;font-size:12px;color:#9CA3AF;text-align:left;font-weight:600;">Date</th>
          <th style="padding:8px 12px;font-size:12px;color:#9CA3AF;text-align:left;font-weight:600;">Employee</th>
          <th style="padding:8px 12px;font-size:12px;color:#9CA3AF;text-align:left;font-weight:600;">Reason</th>
          <th style="padding:8px 12px;font-size:12px;color:#9CA3AF;text-align:right;font-weight:600;">Bucks</th>
        </tr>
      </thead>
      <tbody>${txRows}</tbody>
    </table>
  </div>
  ` : `<div style="padding:0 32px 24px;text-align:center;color:#9CA3AF;font-size:14px;">No transactions this week.</div>`}

  ${itemName && weekItemTx.length > 0 ? `
  <!-- Custom Item transactions -->
  <div style="padding:0 32px 24px;">
    <h3 style="margin:0 0 12px;font-size:13px;font-weight:700;color:#162A4A;text-transform:uppercase;letter-spacing:0.5px;">${escapeHtml(itemName)} Activity This Week</h3>
    <table style="width:100%;border-collapse:collapse;border:1px solid #E2E8F0;border-radius:8px;overflow:hidden;">
      <thead>
        <tr style="background:#F8FAFC;">
          <th style="padding:8px 12px;font-size:12px;color:#9CA3AF;text-align:left;font-weight:600;">Date</th>
          <th style="padding:8px 12px;font-size:12px;color:#9CA3AF;text-align:left;font-weight:600;">Employee</th>
          <th style="padding:8px 12px;font-size:12px;color:#9CA3AF;text-align:left;font-weight:600;">Reason</th>
          <th style="padding:8px 12px;font-size:12px;color:#9CA3AF;text-align:right;font-weight:600;">${escapeHtml(itemName)}</th>
        </tr>
      </thead>
      <tbody>
        ${weekItemTx.slice(0, 50).map(tx => `
          <tr style="border-bottom:1px solid #F1F5F9;">
            <td style="padding:8px 12px;font-size:13px;color:#374151;">${tx.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</td>
            <td style="padding:8px 12px;font-size:13px;color:#374151;">${escapeHtml(tx.user.fullName)}</td>
            <td style="padding:8px 12px;font-size:13px;color:#6B7280;">${escapeHtml(tx.reason || "—")}</td>
            <td style="padding:8px 12px;font-size:13px;font-weight:600;text-align:right;color:${tx.amount >= 0 ? "#4E9F3D" : "#ef4444"};">${tx.amount >= 0 ? "+" : ""}${tx.amount}</td>
          </tr>`).join("")}
      </tbody>
    </table>
    <p style="margin:8px 0 0;font-size:12px;color:#9CA3AF;">
      Total given: +${weekItemTx.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0)} &nbsp;·&nbsp;
      Total redeemed: ${weekItemTx.filter(t => t.amount < 0).reduce((s, t) => s + t.amount, 0)}
    </p>
  </div>
  ` : ""}

  <!-- Footer -->
  <div style="background:#F8FAFC;padding:16px 32px;border-top:1px solid #E2E8F0;">
    <p style="margin:0;font-size:12px;color:#9CA3AF;text-align:center;">This weekly report was automatically generated by Better Bucks and sent to all administrators in your organization. Visit your dashboard at <a href="https://betterbucks.net" style="color:#4E9F3D;">betterbucks.net</a></p>
  </div>

</div>
</body>
</html>`;

  await Promise.all(recipientList.map(email =>
    sendEmail({
      to: email,
      subject: `[Better Bucks] Weekly Report: ${orgName} · ${weekLabel}`,
      html,
    })
  ));
  console.log(`[WeeklyReport] Sent report to ${recipientList.length} recipient(s) for org ${orgName}`);
}

async function getOrgReportEmails(orgId: number, reportRecipientIds: string | null | undefined): Promise<string[]> {
  const orgUsers = await storage.getUsersByOrganization(orgId);
  const approved = orgUsers.filter(u => u.email && u.status === "approved");
  if (reportRecipientIds) {
    try {
      const ids: number[] = JSON.parse(reportRecipientIds);
      const emails = approved.filter(u => ids.includes(u.id)).map(u => u.email as string);
      if (emails.length > 0) return [...new Set(emails)];
    } catch {}
  }
  // Default: all admins & prime admins with email
  return [...new Set(approved.filter(u => u.role === "prime_admin" || u.role === "admin").map(u => u.email as string))];
}

async function sendAllWeeklyReports(): Promise<void> {
  const allOrgs = await storage.getAllOrganizations();
  let sent = 0;
  let skipped = 0;
  for (const org of allOrgs) {
    if (org.status !== "active") { skipped++; continue; }
    const reportEmails = await getOrgReportEmails(org.id, org.reportRecipientIds);
    if (reportEmails.length === 0) { skipped++; continue; }
    try {
      await sendWeeklyReportForOrg(org.id, org.name, reportEmails);
      sent++;
    } catch (err) {
      console.error(`[WeeklyReport] Failed for org ${org.name} (${org.id}):`, err);
    }
  }
  console.log(`[WeeklyReport] Cycle complete: ${sent} orgs sent, ${skipped} skipped.`);
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Setup Auth first
  setupAuth(app);

  // ── Public demo: each session gets its own isolated org (no shared state) ──
  // Writes are now fully allowed for demo users — their org is deleted on exit.

  // Seed default blog posts if none exist (handles fresh production databases)
  await seedBlogPosts();

  // Seed demo org after startup so health checks are never blocked
  setTimeout(() => seedDemoOrg(), 5000);

  // Every hour, clean up stale temp demo orgs whose sessions expired without an explicit exit
  setInterval(() => cleanupStaleDemoOrgs(), 60 * 60 * 1000).unref();

  // robots.txt
  app.get("/robots.txt", (_req, res) => {
    res.type("text/plain").send(
      [
        "User-agent: *",
        "Allow: /",
        // Authenticated app pages — not indexable content
        "Disallow: /api/",
        "Disallow: /admin/",
        "Disallow: /employee/",
        "Disallow: /developer/",
        "Disallow: /join/",
        "Disallow: /invite/",
        "Disallow: /login",
        "Disallow: /forgot-password",
        "Disallow: /reset-password",
        "Disallow: /change-password",
        "Disallow: /reactivate",
        "Disallow: /setup-prime",
        "Disallow: /verify-email",
        "Disallow: /pending-verification",
        "",
        "Sitemap: https://betterbucks.net/sitemap.xml",
      ].join("\n")
    );
  });

  // sitemap.xml — only genuinely indexable public content pages
  app.get("/sitemap.xml", async (_req, res) => {
    const base = "https://betterbucks.net";
    const today = new Date().toISOString().split("T")[0];
    const staticPages = [
      { loc: "/", priority: "1.0", changefreq: "weekly", lastmod: today },
      { loc: "/how-it-works", priority: "0.9", changefreq: "monthly", lastmod: today },
      { loc: "/signup", priority: "0.9", changefreq: "monthly", lastmod: today },
      { loc: "/about", priority: "0.8", changefreq: "monthly", lastmod: today },
      { loc: "/affiliate", priority: "0.8", changefreq: "monthly", lastmod: today },
      { loc: "/blog", priority: "0.7", changefreq: "weekly", lastmod: today },
    ];

    let blogUrls = "";
    try {
      const posts = await storage.getAllBlogPosts();
      blogUrls = posts
        .map((p) => {
          const lm = p.publishedAt ? new Date(p.publishedAt).toISOString().split("T")[0] : today;
          return `  <url>\n    <loc>${base}/blog/${p.slug}</loc>\n    <lastmod>${lm}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.7</priority>\n  </url>`;
        })
        .join("\n");
    } catch { /* ignore */ }

    const staticUrls = staticPages
      .map((p) => `  <url>\n    <loc>${base}${p.loc}</loc>\n    <lastmod>${p.lastmod}</lastmod>\n    <changefreq>${p.changefreq}</changefreq>\n    <priority>${p.priority}</priority>\n  </url>`)
      .join("\n");

    const combined = [staticUrls, blogUrls].filter(Boolean).join("\n");
    res
      .type("application/xml")
      .send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${combined}\n</urlset>`);
  });

  // Users
  app.get(api.users.list.path, async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user || (user.role !== "admin" && user.role !== "prime_admin")) {
      return res.status(401).send("Unauthorized");
    }
    if (!user.organizationId) {
      return res.json([]);
    }
    let allUsers = await storage.getUsersByOrganization(user.organizationId);
    res.json(sanitizeUsers(allUsers));
  });

  // Forgot password — send 6-digit reset code via email or phone
  app.post("/api/auth/forgot-password", asyncHandler(async (req, res) => {
    const { contact } = z.object({ contact: z.string().min(1) }).parse(req.body);
    const trimmed = contact.trim();
    const isEmail = trimmed.includes("@");
    const lookup = isEmail ? trimmed.toLowerCase() : trimmed;
    const user = isEmail
      ? await storage.getUserByEmailGlobal(lookup)
      : await storage.getUserByPhoneGlobal(lookup);

    const genericMsg = "If an account with that contact exists, a reset code has been sent.";

    if (!user) {
      console.log(`[Password Reset] No account found for ${isEmail ? maskEmail(lookup) : maskPhone(lookup)}`);
      // Pretend a delay similar to the real email send so we don't reveal existence by timing.
      await new Promise(resolve => setTimeout(resolve, 250));
      return res.json({ message: genericMsg });
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await storage.setPasswordResetToken(user.id, code, expiry);

    if (isEmail) {
      const targetEmail = user.email || lookup;
      try {
        await sendEmail({
          to: targetEmail,
          subject: "Reset your Better Bucks password",
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
              ${emailLogoHeader}
              <p>Hi ${escapeHtml(user.fullName)},</p>
              <p>We received a request to reset your Better Bucks password. Your 6-digit reset code is:</p>
              <div style="background: #EEF4FB; padding: 16px; border-radius: 8px; text-align: center; font-size: 36px; letter-spacing: 8px; font-weight: bold; color: #162A4A;">${code}</div>
              <p style="margin-top: 16px; color: #666;">This code expires in 1 hour. If you didn't request a password reset, you can safely ignore this email.</p>
              <p style="margin-top: 16px; color: #666; font-size: 12px;">Need help? Contact <a href="mailto:miles.chase@betterbucks.net">miles.chase@betterbucks.net</a>.</p>
            </div>
          `,
          text: `Hi ${user.fullName},\n\nYour Better Bucks password reset code is: ${code}\n\nThis code expires in 1 hour. If you didn't request this, ignore this email.`,
        });
        console.log(`[Password Reset] Email sent to ${maskEmail(targetEmail)} for user ${user.id}`);
      } catch (err: any) {
        console.error(`[Password Reset] Email send FAILED for user ${user.id} (${maskEmail(targetEmail)}):`, err?.message ?? err);
        return res.status(500).json({
          message: "We couldn't send the reset email. Please try again in a moment, or contact miles.chase@betterbucks.net.",
        });
      }
    } else {
      const targetPhone = user.phone || lookup;
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      const fromNumber = process.env.TWILIO_PHONE_NUMBER;
      if (!accountSid || !authToken || !fromNumber) {
        console.error(`[Password Reset] Twilio not configured — cannot send SMS to ${maskPhone(targetPhone)}`);
        return res.status(500).json({
          message: "SMS reset isn't available right now. Please use the email option, or contact miles.chase@betterbucks.net.",
        });
      }
      try {
        const twResp = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
          method: "POST",
          headers: {
            "Authorization": "Basic " + Buffer.from(`${accountSid}:${authToken}`).toString("base64"),
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            To: targetPhone,
            From: fromNumber,
            Body: `Your Better Bucks password reset code is: ${code}. It expires in 1 hour.`,
          }),
        });
        if (!twResp.ok) {
          const body = await twResp.text();
          throw new Error(`Twilio responded ${twResp.status}: ${body.slice(0, 200)}`);
        }
        console.log(`[Password Reset] SMS sent to ${maskPhone(targetPhone)} for user ${user.id}`);
      } catch (err: any) {
        console.error(`[Password Reset] SMS send FAILED for user ${user.id}:`, err?.message ?? err);
        return res.status(500).json({
          message: "We couldn't send the reset text message. Please try again, or contact miles.chase@betterbucks.net.",
        });
      }
    }

    res.json({ message: genericMsg });
  }));

  // Reset password via Site ID — only allowed for users who have never set their own password
  // (lastPlainPassword is null, meaning their current password is a system-generated placeholder
  // they don't know). Requires Site ID + employee code (username) + new password.
  app.post("/api/auth/reset-password-via-site-id", asyncHandler(async (req, res) => {
    const { siteId, username, newPassword } = z.object({
      siteId: z.string().trim().min(1),
      username: z.string().trim().min(1),
      newPassword: z.string().min(6, "Password must be at least 6 characters"),
    }).parse(req.body);

    const org = await storage.getOrganizationBySiteId(siteId.toLowerCase());
    if (!org || org.status !== "active") {
      return res.status(404).json({ message: "Invalid or inactive Site ID." });
    }

    const user = await storage.getUserByUsernameAndOrg(username, org.id);
    if (!user) {
      return res.status(404).json({ message: "No account found with that employee code at this Site ID." });
    }

    if (user.status !== "approved") {
      return res.status(403).json({ message: "Your account is not approved yet. Contact your administrator." });
    }

    // Only allow this shortcut when the user has never set their own password.
    if (user.lastPlainPassword && user.lastPlainPassword.length > 0) {
      return res.status(403).json({
        message: "You already have a password set. Use the email or phone reset option instead.",
      });
    }

    await storage.updateUserPassword(user.id, newPassword);
    await storage.setPasswordResetToken(user.id, null, null);
    invalidateUserCache(user.id);
    console.log(`[Password Reset] Site ID reset succeeded for user ${user.id} at org ${org.id}`);

    res.json({ message: "Password set successfully. You can now log in with your new password." });
  }));

  // Reset password — validate code and set new password
  app.post("/api/auth/reset-password", asyncHandler(async (req, res) => {
    const { contact, code, newPassword } = z.object({
      contact: z.string().min(1),
      code: z.string().min(4),
      newPassword: z.string().min(6),
    }).parse(req.body);

    const isEmail = contact.includes("@");
    const user = isEmail
      ? await storage.getUserByEmailGlobal(contact.toLowerCase().trim())
      : await storage.getUserByPhoneGlobal(contact.trim());

    if (!user || !user.passwordResetToken || user.passwordResetToken !== code) {
      return res.status(400).json({ message: "Invalid or expired reset code." });
    }
    if (!user.passwordResetExpiry || new Date() > new Date(user.passwordResetExpiry)) {
      return res.status(400).json({ message: "Reset code has expired. Please request a new one." });
    }

    await storage.updateUserPassword(user.id, newPassword);
    await storage.setPasswordResetToken(user.id, null, null);

    res.json({ message: "Password reset successfully. You can now log in with your new password." });
  }));

  // Register new admin account - requires org code, goes into pending queue
  app.post(api.auth.registerAdmin.path, async (req, res) => {
    try {
      const adminData = api.auth.registerAdmin.input.parse(req.body);
      const orgCode = req.body.orgCode;
      if (!orgCode) {
        return res.status(400).json({ message: "Organization code is required" });
      }
      const org = await storage.getOrganizationByCode(orgCode.toUpperCase());
      if (!org || org.status !== "active") {
        return res.status(400).json({ message: "Invalid or inactive organization code" });
      }
      const existingUser = await storage.getUserByUsernameAndOrg(adminData.username, org.id);
      if (existingUser) {
        return res.status(409).json({ message: "Username already exists in this organization" });
      }
      if (org.maxEmployees > 0) {
        const orgUsers = await storage.getUsersByOrganization(org.id);
        if (orgUsers.length >= org.maxEmployees) {
          return res.status(400).json({ message: `This organization has reached its employee limit (${org.maxEmployees}). Please contact your administrator to upgrade the plan.` });
        }
      }
      const adminEmail = req.body.email;
      const adminPhone = req.body.phone;
      const hasEmail = adminEmail && z.string().email().safeParse(adminEmail).success;
      const hasPhone = adminPhone && adminPhone.length >= 10;
      if (!hasEmail) {
        return res.status(400).json({ message: "A valid email address is required for administrator accounts." });
      }
      if (hasEmail) {
        const existingEmail = await storage.getUserByEmailGlobal(adminEmail);
        if (existingEmail) {
          return res.status(400).json({ message: "This email is already associated with an existing account. You must delete that account before using this email for a new one." });
        }
      }
      if (hasPhone) {
        const existingPhone = await storage.getUserByPhoneGlobal(adminPhone);
        if (existingPhone) {
          return res.status(400).json({ message: "This phone number is already associated with an existing account. You must delete that account before using this number for a new one." });
        }
      }

      const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

      const user = await storage.createUser({
        username: adminData.username,
        password: await hashPassword(adminData.password),
        lastPlainPassword: adminData.password,
        fullName: adminData.fullName,
        email: hasEmail ? adminEmail : null,
        phone: hasPhone ? adminPhone : null,
        emailVerificationCode: verificationCode,
        role: "admin",
        barcode: adminData.username,
        status: "pending",
        organizationId: org.id,
      });

      sendVerificationCode(hasEmail ? adminEmail : null, hasPhone ? adminPhone : null, verificationCode, adminData.fullName).catch(() => {});
      notifyAllPrimeAdmins(org.id, "New Account Pending Approval", {
        "Name": adminData.fullName,
        "Username": adminData.username,
        "Organization": org.name,
        "Email": adminEmail || "—",
        "Phone": adminPhone || "—",
        "Requested Role": "Admin",
        "Status": "Awaiting your approval",
        "Action": "Log in to Better Bucks → Employees → Pending Accounts to approve or reject.",
      });
      console.log(`New admin registration for org ${org.name} (pending)`);
      res.status(201).json({ ...user, message: "Admin registration submitted. Awaiting verification." });
    } catch (e) {
      if (e instanceof z.ZodError) {
        res.status(400).json({ message: "Validation error", field: e.errors[0]?.path?.join(".") });
      } else {
        console.error("Registration error:", e);
        res.status(500).json({ message: "Internal Server Error" });
      }
    }
  });

  app.post(api.auth.registerEmployee.path, async (req, res) => {
    try {
      const empData = api.auth.registerEmployee.input.parse(req.body);
      const orgCode = req.body.orgCode;
      if (!orgCode) {
        return res.status(400).json({ message: "Organization code is required" });
      }
      const org = await storage.getOrganizationByCode(orgCode.toUpperCase());
      if (!org || org.status !== "active") {
        return res.status(400).json({ message: "Invalid or inactive organization code" });
      }
      const existingUser = await storage.getUserByUsernameAndOrg(empData.username, org.id);
      if (existingUser) {
        return res.status(409).json({ message: "Username already exists in this organization" });
      }
      if (org.maxEmployees > 0) {
        const orgUsers = await storage.getUsersByOrganization(org.id);
        if (orgUsers.length >= org.maxEmployees) {
          return res.status(400).json({ message: `This organization has reached its employee limit (${org.maxEmployees}). Please contact your administrator to upgrade the plan.` });
        }
      }
      const empEmail = req.body.email;
      const empPhone = req.body.phone;
      const hasEmail = empEmail && z.string().email().safeParse(empEmail).success;
      const hasPhone = empPhone && empPhone.length >= 10;
      if (!hasEmail && !hasPhone) {
        return res.status(400).json({ message: "Please provide either a valid email address or phone number" });
      }
      if (hasEmail) {
        const existingEmail = await storage.getUserByEmailGlobal(empEmail);
        if (existingEmail) {
          return res.status(400).json({ message: "This email is already associated with an existing account. You must delete that account before using this email for a new one." });
        }
      }
      if (hasPhone) {
        const existingPhone = await storage.getUserByPhoneGlobal(empPhone);
        if (existingPhone) {
          return res.status(400).json({ message: "This phone number is already associated with an existing account. You must delete that account before using this number for a new one." });
        }
      }

      const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

      const user = await storage.createUser({
        username: empData.username,
        password: await hashPassword(empData.password),
        lastPlainPassword: empData.password,
        fullName: empData.fullName,
        email: hasEmail ? empEmail : null,
        phone: hasPhone ? empPhone : null,
        emailVerificationCode: verificationCode,
        role: "employee",
        barcode: empData.username,
        status: "pending",
        organizationId: org.id,
      });

      sendVerificationCode(hasEmail ? empEmail : null, hasPhone ? empPhone : null, verificationCode, empData.fullName).catch(() => {});
      notifyAllPrimeAdmins(org.id, "New Account Pending Approval", {
        "Name": empData.fullName,
        "Username": empData.username,
        "Organization": org.name,
        "Email": empEmail || "—",
        "Phone": empPhone || "—",
        "Requested Role": "Employee",
        "Status": "Awaiting your approval",
        "Action": "Log in to Better Bucks → Employees → Pending Accounts to approve or reject.",
      });
      console.log(`New employee registration for org ${org.name} (pending approval)`);
      res.status(201).json({ ...user, message: "Employee registration submitted. Awaiting admin approval." });
    } catch (e) {
      if (e instanceof z.ZodError) {
        res.status(400).json({ message: "Validation error", field: e.errors[0]?.path?.join(".") });
      } else {
        console.error("Employee registration error:", e);
        res.status(500).json({ message: "Internal Server Error" });
      }
    }
  });

  // ── Employee QR Join (passwordless) ────────────────────────────────────────

  // Public: look up org info by site ID
  app.get("/api/join/:siteId", async (req, res) => {
    try {
      const { siteId } = req.params;
      const org = await storage.getOrganizationBySiteId(siteId);
      if (!org || org.status !== "active") {
        return res.status(404).json({ message: "Invalid or inactive Site ID" });
      }
      res.json({ orgName: org.name, siteId: org.siteId, employeeRoleLabel: org.employeeRoleLabel, allowPasswordCreation: org.allowEmployeePasswordCreation ?? true });
    } catch (e) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  // Public: employee login or self-registration via Site ID (no password)
  app.post("/api/join", async (req, res) => {
    try {
      const { siteId, username, fullName, password } = req.body;
      if (!siteId || !username) {
        return res.status(400).json({ message: "Site ID and username are required" });
      }
      const trimmedUsername = String(username).trim();
      const trimmedSiteId = String(siteId).trim().toLowerCase();

      const org = await storage.getOrganizationBySiteId(trimmedSiteId);
      if (!org || org.status !== "active") {
        return res.status(404).json({ message: "Invalid or inactive Site ID" });
      }

      const existingUser = await storage.getUserByUsernameAndOrg(trimmedUsername, org.id);
      if (existingUser) {
        if (existingUser.status !== "approved") {
          return res.status(403).json({ message: "Your account is pending approval. Please contact your administrator." });
        }
        req.login(existingUser, async (err) => {
          if (err) return res.status(500).json({ message: "Login failed" });
          const updated = await storage.incrementSuccessfulLoginCount(existingUser.id);
          return res.json(updated);
        });
        return;
      }

      // New employee — need full name to register
      if (!fullName || !String(fullName).trim()) {
        return res.status(200).json({ needsRegistration: true, allowPasswordCreation: org.allowEmployeePasswordCreation ?? true });
      }

      const trimmedFullName = String(fullName).trim();

      // Check employee limit
      if (org.maxEmployees > 0) {
        const orgUsers = await storage.getUsersByOrganization(org.id);
        if (orgUsers.length >= org.maxEmployees) {
          return res.status(400).json({ message: `This organization has reached its employee limit (${org.maxEmployees}). Please contact your administrator.` });
        }
      }

      // Check username uniqueness (global)
      const globalExisting = await storage.getUserByUsername(trimmedUsername);
      if (globalExisting) {
        return res.status(409).json({ message: "This username is already taken. Please choose a different one." });
      }

      // Use provided password if org allows it, otherwise assign a random placeholder
      const allowPwdCreation = org.allowEmployeePasswordCreation ?? true;
      const rawPass = (allowPwdCreation && password && String(password).trim().length >= 6)
        ? String(password).trim()
        : crypto.randomBytes(32).toString("hex");
      const hashedPass = await hashPassword(rawPass);
      const user = await storage.createUser({
        username: trimmedUsername,
        password: hashedPass,
        lastPlainPassword: (allowPwdCreation && password && String(password).trim().length >= 6) ? String(password).trim() : null,
        fullName: trimmedFullName,
        email: null,
        phone: null,
        emailVerified: true,
        role: "employee",
        barcode: trimmedUsername,
        status: "pending",
        organizationId: org.id,
      });

      notifyAllPrimeAdmins(org.id, "New Account Pending Approval", {
        "Name": trimmedFullName,
        "Username": trimmedUsername,
        "Organization": org.name,
        "Method": "QR Code / Site ID",
        "Requested Role": "Employee",
        "Status": "Awaiting your approval",
        "Action": "Log in to Better Bucks → Employees → Pending Accounts to approve or reject.",
      }).catch(() => {});

      return res.status(201).json({ pendingApproval: true, fullName: trimmedFullName });
    } catch (e) {
      console.error("Join error:", e);
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  // Admin: check if a site ID is available
  app.get("/api/organizations/site-id/check/:siteId", async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user || (user.role !== "prime_admin" && user.role !== "developer")) {
      return res.status(403).json({ message: "Forbidden" });
    }
    try {
      const { siteId } = req.params;
      const normalized = siteId.toLowerCase();
      const existing = await storage.getOrganizationBySiteId(normalized);
      const available = !existing || existing.id === user.organizationId;
      res.json({ available });
    } catch (e) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  // Admin: set site ID for organization
  app.patch("/api/organizations/site-id", async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user || (user.role !== "prime_admin" && user.role !== "developer")) {
      return res.status(403).json({ message: "Forbidden" });
    }
    try {
      const { siteId } = req.body;
      if (!siteId || typeof siteId !== "string") {
        return res.status(400).json({ message: "Site ID is required" });
      }
      const normalized = siteId.trim().toLowerCase();
      if (!/^[a-z0-9-]{3,30}$/.test(normalized)) {
        return res.status(400).json({ message: "Site ID must be 3–30 characters using only lowercase letters, numbers, and hyphens" });
      }
      const orgId = user.organizationId;
      if (!orgId) return res.status(400).json({ message: "No organization found" });

      const existing = await storage.getOrganizationBySiteId(normalized);
      if (existing && existing.id !== orgId) {
        return res.status(409).json({ message: "This Site ID is already taken. Please choose a different one." });
      }

      const updated = await storage.setOrganizationSiteId(orgId, normalized);
      res.json(updated);
    } catch (e) {
      console.error("Set site ID error:", e);
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  // ── End Employee QR Join ─────────────────────────────────────────────────

  app.post(api.users.create.path, async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user || (user.role !== "admin" && user.role !== "prime_admin")) {
      return res.status(401).send("Unauthorized");
    }
    try {
      const userData = api.users.create.input.parse(req.body);
      const empEmail = userData.email;
      const empPhone = (req.body as any).phone;
      const hasEmail = empEmail && z.string().email().safeParse(empEmail).success;
      const hasPhone = empPhone && String(empPhone).length >= 10;
      const isEmployee = userData.role === "employee" || !userData.role;

      // Admins and prime_admins must have a valid email; employees can be passwordless
      if (!isEmployee && !hasEmail) {
        return res.status(400).json({ message: "A valid email address is required for administrator accounts." });
      }

      if (user.organizationId) {
        const existingUser = await storage.getUserByUsernameAndOrg(userData.username, user.organizationId);
        if (existingUser) {
          return res.status(400).json({ message: "Username/Employee Code already exists in this organization" });
        }
        if (hasEmail) {
          const existingEmail = await storage.getUserByEmailGlobal(empEmail);
          if (existingEmail) {
            return res.status(400).json({ message: "This email is already associated with an existing account. You must delete that account before using this email for a new one." });
          }
        }
        if (hasPhone) {
          const existingPhone = await storage.getUserByPhoneGlobal(empPhone);
          if (existingPhone) {
            return res.status(400).json({ message: "This phone number is already associated with an existing account. You must delete that account before using this number for a new one." });
          }
        }
        const org = await storage.getOrganization(user.organizationId);
        if (org && org.maxEmployees > 0) {
          const orgUsers = await storage.getUsersByOrganization(user.organizationId);
          if (orgUsers.length >= org.maxEmployees) {
            const tierNames: Record<string, string> = { small: "Small Site (25)", mid: "Mid-Size Site (75)", large: "Large Site (150)", enterprise: "Enterprise (Unlimited)" };
            return res.status(400).json({ message: `Employee limit reached for your ${tierNames[org.tier] || org.tier} plan (${org.maxEmployees} max). Please upgrade your plan to add more team members.` });
          }
        }
      }

      // Use provided password or generate a random one for passwordless employees
      const rawPassword = userData.password && userData.password.length >= 6
        ? userData.password
        : null;
      const userPassword = rawPassword
        ? await hashPassword(rawPassword)
        : await hashPassword(crypto.randomBytes(32).toString("hex"));

      const verificationCode = (hasEmail || hasPhone)
        ? Math.floor(100000 + Math.random() * 900000).toString()
        : null;

      const newUser = await storage.createUser({
        ...userData,
        password: userPassword,
        lastPlainPassword: rawPassword,
        barcode: userData.barcode || userData.username,
        email: hasEmail ? empEmail : null,
        phone: hasPhone ? empPhone : null,
        emailVerified: (!hasEmail && !hasPhone) || isEmployee,
        emailVerificationCode: verificationCode,
        status: "approved",
        mustChangePassword: !!(userData.password && userData.password.length >= 6),
        organizationId: user.organizationId,
      });

      if (hasEmail || hasPhone) {
        sendVerificationCode(hasEmail ? empEmail : null, hasPhone ? empPhone : null, verificationCode!, userData.fullName).catch(() => {});
      }
      if (user.organizationId) {
        const orgPrimeEmail = await getOrgPrimeAdminEmail(user.organizationId);
        if (orgPrimeEmail) {
          notifyAdmin(orgPrimeEmail, "New Employee Account — Created by Admin", {
            "Name": userData.fullName,
            "Username": userData.username,
            "Organization ID": String(user.organizationId),
            "Email": empEmail || "—",
            "Phone": empPhone || "—",
            "Status": "Active (admin-created)",
          });
        }
      }

      res.status(201).json(newUser);
    } catch (e) {
      if (e instanceof z.ZodError) {
        res.status(400).json(e.errors);
      } else {
        res.status(500).json({ message: "Internal Server Error" });
      }
    }
  });

  app.get("/api/users/pending-admins", async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user || user.role !== "prime_admin") {
      return res.status(401).send("Unauthorized");
    }
    try {
      const pendingAdmins = user.organizationId 
        ? await storage.getPendingAdminsByOrganization(user.organizationId)
        : await storage.getPendingAdmins();
      res.json(sanitizeUsers(pendingAdmins));
    } catch (error) {
      console.error("Error fetching pending admins:", error);
      res.status(500).send("Internal Server Error");
    }
  });

  app.get("/api/users/pending", async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user || user.role !== "prime_admin") {
      return res.status(403).json({ message: "Forbidden" });
    }
    const orgUsers = await storage.getUsersByOrganization(user.organizationId!);
    const pending = orgUsers.filter(u => u.status === "pending");
    res.json(pending);
  });

  app.get("/api/users/pending-accounts", async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user || user.role !== "prime_admin") {
      return res.status(403).json({ message: "Forbidden" });
    }
    if (!user.organizationId) return res.json([]);
    try {
      const [orgUsers, departments] = await Promise.all([
        storage.getUsersByOrganization(user.organizationId),
        storage.getDepartmentsByOrganization(user.organizationId),
      ]);
      const deptMap = new Map(departments.map(d => [d.id, d.name]));
      const pending = orgUsers.filter(u => u.id !== user!.id && (u.status === "pending" || u.successfulLoginCount === 0));
      const pendingIds = pending.map(u => u.id);

      let txCountMap = new Map<number, number>();
      if (pendingIds.length > 0) {
        const txRows = await db
          .select({ userId: transactions.userId, cnt: sql<number>`cast(count(*) as int)` })
          .from(transactions)
          .where(inArray(transactions.userId, pendingIds))
          .groupBy(transactions.userId);
        txRows.forEach(r => txCountMap.set(r.userId, r.cnt));
      }

      const accounts = pending.map(u => ({
        id: u.id,
        fullName: u.fullName,
        username: u.username,
        email: u.email,
        role: u.role,
        status: u.status,
        balance: u.balance,
        departmentId: u.departmentId,
        departmentName: u.departmentId ? (deptMap.get(u.departmentId) ?? null) : null,
        successfulLoginCount: u.successfulLoginCount,
        transactionCount: txCountMap.get(u.id) ?? 0,
        pendingType: u.status === "pending" ? "awaiting_approval" : "never_logged_in",
      }));
      res.json(accounts);
    } catch (e) {
      console.error("Error fetching pending accounts:", e);
      res.status(500).json({ message: "Failed to fetch pending accounts" });
    }
  });

  app.get(api.users.get.path, async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user) return res.status(401).send("Unauthorized");
    
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).send("Invalid ID");

    if (user.role !== "admin" && user.role !== "prime_admin" && user.id !== id) {
      return res.status(403).send("Forbidden");
    }

    const userResult = await storage.getUser(id);
    if (!userResult || userResult.organizationId !== user.organizationId) return res.status(404).send("User not found");

    const transactions = await storage.getTransactionsByUser(id);
    res.json({ ...userResult, transactions });
  });

  app.post(api.users.bulkCredit.path, async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user || (user.role !== "admin" && user.role !== "prime_admin")) {
      return res.status(401).send("Unauthorized");
    }

    const { userIds, amount, reason, categoryId } = api.users.bulkCredit.input.parse(req.body);

    if (categoryId) {
      const cat = (await storage.getCategoriesByOrg(user.organizationId!)).find(c => c.id === categoryId);
      if (!cat) return res.status(400).json({ message: "Invalid category" });
    }

    const allOrgUsers = await storage.getUsersByOrganization(user.organizationId!);
    const targetUserMap = new Map(allOrgUsers.map(u => [u.id, u]));
    const validTargetIds = userIds.filter(tid => {
      const t = targetUserMap.get(tid);
      return t && t.id !== user.id;
    });

    if (validTargetIds.length === 0) return res.json({ credited: 0 });

    if (user.role !== "prime_admin") {
      const totalCost = amount * validTargetIds.length;
      const result = await db.transaction(async (tx) => {
        const [admin] = await tx.select().from(users).where(eq(users.id, user.id)).for("update");
        if (!admin || admin.balance < totalCost) {
          return { error: `Insufficient balance. Need ${totalCost.toLocaleString()} pts to credit ${validTargetIds.length} employees (${amount.toLocaleString()} pts each), but only have ${(admin?.balance ?? 0).toLocaleString()} pts.` };
        }
        await tx.update(users).set({ balance: sql`${users.balance} - ${totalCost}` }).where(eq(users.id, user.id));
        for (const targetId of validTargetIds) {
          const targetUser = targetUserMap.get(targetId)!;
          await tx.insert(transactions).values({
            userId: user.id, amount: -amount,
            reason: `Bucks given to ${targetUser.fullName}`, performedBy: user.id,
          });
          await tx.update(users).set({ balance: sql`${users.balance} + ${amount}` }).where(eq(users.id, targetId));
          await tx.insert(transactions).values({
            userId: targetId, amount, reason, performedBy: user.id,
            ...(categoryId ? { categoryId } : {}),
          });
        }
        return { credited: validTargetIds.length };
      });
      if ("error" in result) return res.status(400).json({ message: result.error });
      invalidateUserCache(user.id);
      return res.json(result);
    }

    let credited = 0;
    for (const targetId of validTargetIds) {
      const targetUser = targetUserMap.get(targetId)!;
      await storage.createTransaction({
        userId: user.id, amount: -amount,
        reason: `Bucks given to ${targetUser.fullName}`, performedBy: user.id,
      });
      await storage.updateUserBalance(targetId, amount);
      await storage.createTransaction({
        userId: targetId, amount, reason, performedBy: user.id,
        ...(categoryId ? { categoryId } : {}),
      });
      credited++;
    }

    res.json({ credited });
  });

  app.post(api.users.bulkDebit.path, async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user || (user.role !== "admin" && user.role !== "prime_admin")) {
      return res.status(401).send("Unauthorized");
    }

    const { userIds, amount, reason } = api.users.bulkDebit.input.parse(req.body);

    const allOrgUsers = await storage.getUsersByOrganization(user.organizationId!);
    const targetUserMap = new Map(allOrgUsers.map(u => [u.id, u]));

    let debited = 0;
    for (const targetId of userIds) {
      const targetUser = targetUserMap.get(targetId);
      if (!targetUser) continue;
      if (targetUser.id === user.id) continue;

      const deductAmount = Math.min(amount, Math.max(0, targetUser.balance));
      if (deductAmount === 0) continue;

      await storage.updateUserBalance(targetId, -deductAmount);
      await storage.createTransaction({
        userId: targetId,
        amount: -deductAmount,
        reason,
        performedBy: user.id,
      });
      debited++;
    }

    res.json({ debited });
  });

  // ── Bulk import: start background job ────────────────────────────────────
  app.post("/api/users/bulk-import", async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user || (user.role !== "admin" && user.role !== "prime_admin")) {
      return res.status(401).send("Unauthorized");
    }
    if (!user.organizationId) return res.status(400).json({ message: "No organization" });

    const rows: ImportJobRow[] = req.body.employees;
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ message: "No employee rows provided" });
    }
    if (rows.length > 5000) {
      return res.status(400).json({ message: "Maximum 5 000 rows per import" });
    }

    const jobId = crypto.randomBytes(16).toString("hex");
    const job: ImportJob = {
      id: jobId,
      orgId: user.organizationId,
      initiatorEmail: user.email ?? null,
      initiatorName: user.fullName,
      status: "running",
      total: rows.length,
      processed: 0,
      imported: 0,
      results: [],
      cancelRequested: false,
      createdAt: Date.now(),
    };
    importJobs.set(jobId, job);

    // Respond immediately — client will poll for progress
    res.json({ jobId, total: rows.length });

    // Run processing in the background (do not await)
    (async () => {
      try {
        const org = await storage.getOrganization(job.orgId);
        const departments = await storage.getDepartmentsByOrganization(job.orgId);
        const deptMap = new Map(departments.map(d => [d.name.toLowerCase(), d.id]));
        const orgUsers = await storage.getUsersByOrganization(job.orgId);
        const adminUsers = orgUsers.filter(u => u.role === "admin" || u.role === "prime_admin");
        const adminNameMap = new Map(adminUsers.map(a => [a.fullName.toLowerCase(), a.id]));

        for (let i = 0; i < rows.length; i++) {
          if (job.cancelRequested) { job.status = "cancelled"; break; }

          const row = rows[i];
          const rowNum = i + 1;

          if (!row.fullName?.trim()) {
            job.results.push({ row: rowNum, username: row.username || "", fullName: row.fullName || "", success: false, error: "Full Name is required" });
            job.processed++; continue;
          }
          if (!row.username?.trim()) {
            job.results.push({ row: rowNum, username: "", fullName: row.fullName, success: false, error: "Employee Code is required" });
            job.processed++; continue;
          }

          const rawRole = row.role?.toLowerCase().trim() ?? "";
          const role: "employee" | "admin" | "prime_admin" =
            rawRole === "prime_admin" ? "prime_admin" :
            rawRole === "admin" ? "admin" : "employee";

          const email = row.email?.trim() || null;
          const hasEmail = !!(email && z.string().email().safeParse(email).success);

          if ((role === "admin" || role === "prime_admin") && !hasEmail) {
            job.results.push({ row: rowNum, username: row.username, fullName: row.fullName, success: false, error: `${role === "prime_admin" ? "Prime Admin" : "Admin"} accounts require a valid email` });
            job.processed++; continue;
          }

          // Check employee limit (re-check per row)
          if (org && org.maxEmployees > 0) {
            const currentCount = await storage.getUsersByOrganization(job.orgId);
            if (currentCount.length >= org.maxEmployees) {
              job.results.push({ row: rowNum, username: row.username, fullName: row.fullName, success: false, error: "Employee limit reached — upgrade your plan" });
              job.processed++; continue;
            }
          }

          // Duplicate username check
          const existing = await storage.getUserByUsernameAndOrg(row.username.trim(), job.orgId);
          if (existing) {
            job.results.push({ row: rowNum, username: row.username, fullName: row.fullName, success: false, error: "Employee code already exists" });
            job.processed++; continue;
          }

          // Duplicate email check
          if (hasEmail) {
            const existingEmail = await storage.getUserByEmailGlobal(email!);
            if (existingEmail) {
              job.results.push({ row: rowNum, username: row.username, fullName: row.fullName, success: false, error: "Email already in use by another account" });
              job.processed++; continue;
            }
          }

          const deptId = row.departmentName ? (deptMap.get(row.departmentName.toLowerCase()) ?? null) : null;
          const mgrName = row.managerName?.trim();
          let managerId: number | null = null;
          if (mgrName) {
            const foundMgr = adminNameMap.get(mgrName.toLowerCase());
            if (foundMgr) {
              managerId = foundMgr;
            } else {
              job.results.push({ row: rowNum, username: row.username, fullName: row.fullName, success: false, error: `Manager "${mgrName}" not found — must be an existing admin's full name` });
              job.processed++; continue;
            }
          }
          const rawPassword = row.password?.trim();
          const userPassword = rawPassword && rawPassword.length >= 6
            ? await hashPassword(rawPassword)
            : await hashPassword(crypto.randomBytes(32).toString("hex"));
          const verificationCode = hasEmail ? Math.floor(100000 + Math.random() * 900000).toString() : null;

          try {
            const newUser = await storage.createUser({
              username: row.username.trim(),
              password: userPassword,
              lastPlainPassword: (rawPassword && rawPassword.length >= 6) ? rawPassword : null,
              fullName: row.fullName.trim(),
              email: hasEmail ? email : null,
              phone: null,
              emailVerified: !hasEmail,
              emailVerificationCode: verificationCode,
              role,
              barcode: row.username.trim(),
              status: "approved",
              mustChangePassword: !!(rawPassword && rawPassword.length >= 6),
              organizationId: job.orgId,
              departmentId: deptId,
            });
            if (managerId) {
              await storage.updateUserManager(newUser.id, managerId);
            }
            if (hasEmail && verificationCode) {
              sendVerificationCode(email, null, verificationCode, row.fullName.trim()).catch(() => {});
            }
            if (role === "admin" || role === "prime_admin") {
              adminNameMap.set(row.fullName.trim().toLowerCase(), newUser.id);
            }
            job.results.push({ row: rowNum, username: row.username, fullName: row.fullName, success: true });
            job.imported++;
          } catch {
            job.results.push({ row: rowNum, username: row.username, fullName: row.fullName, success: false, error: "Failed to create account" });
          }

          job.processed++;
          // Yield every 10 rows to keep event loop responsive
          if (i % 10 === 9) await new Promise(resolve => setImmediate(resolve));
        }

        if (job.status === "running") job.status = "done";

        // Send completion email to whoever started the import
        if (job.initiatorEmail) {
          const statusLabel = job.status === "cancelled" ? "Cancelled" : "Complete";
          const html = `
            <div style="font-family:Arial,sans-serif;max-width:540px;margin:0 auto;padding:24px;">
              ${emailLogoHeader}
              <h3 style="color:#4E9F3D;margin-top:0;text-align:center;">Employee Import ${statusLabel}</h3>
              <p style="color:#555;font-size:14px;">Hi ${escapeHtml(job.initiatorName)},</p>
              <p style="color:#555;font-size:14px;">Your employee spreadsheet import has finished processing.</p>
              <table style="border-collapse:collapse;width:100%;background:#F8FAFC;border-radius:8px;overflow:hidden;margin:16px 0;">
                <tr><td style="padding:8px 12px;color:#666;font-weight:500;">Status</td><td style="padding:8px 12px;">${statusLabel}</td></tr>
                <tr><td style="padding:8px 12px;color:#666;font-weight:500;">Imported</td><td style="padding:8px 12px;color:#4E9F3D;font-weight:600;">${job.imported}</td></tr>
                <tr><td style="padding:8px 12px;color:#666;font-weight:500;">Total rows</td><td style="padding:8px 12px;">${job.total}</td></tr>
                ${job.total - job.imported > 0 ? `<tr><td style="padding:8px 12px;color:#666;font-weight:500;">Skipped / errors</td><td style="padding:8px 12px;color:#DC2626;">${job.total - job.imported}</td></tr>` : ""}
              </table>
              <p style="color:#999;font-size:12px;margin-top:16px;">You can review the full row-by-row results in the Better Bucks admin panel.</p>
            </div>`;
          sendEmail({ to: job.initiatorEmail, subject: `[Better Bucks] Employee Import ${statusLabel} — ${job.imported}/${job.total} imported`, html })
            .catch(err => console.error("[BulkImport] Completion email failed:", err));
        }
      } catch (err) {
        console.error("[BulkImport] Background job error:", err);
        const job = importJobs.get(jobId);
        if (job) job.status = "done";
      }
    })();
  });

  // ── Bulk import: poll job status ──────────────────────────────────────────
  app.get("/api/users/bulk-import/:jobId", (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user) return res.status(401).send("Unauthorized");
    const job = importJobs.get(req.params.jobId);
    if (!job || job.orgId !== user.organizationId) return res.status(404).json({ message: "Job not found" });
    res.json({
      status: job.status,
      total: job.total,
      processed: job.processed,
      imported: job.imported,
      results: job.status !== "running" ? job.results : [],
    });
  });

  // ── Bulk import: cancel job ────────────────────────────────────────────────
  app.delete("/api/users/bulk-import/:jobId", (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user) return res.status(401).send("Unauthorized");
    const job = importJobs.get(req.params.jobId);
    if (!job || job.orgId !== user.organizationId) return res.status(404).json({ message: "Job not found" });
    if (job.status === "running") job.cancelRequested = true;
    res.json({ ok: true });
  });

  app.post(api.users.updateBalance.path, async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user || (user.role !== "admin" && user.role !== "prime_admin")) {
      return res.status(401).send("Unauthorized");
    }

    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).send("Invalid ID");

    const { amount, reason, categoryId } = api.users.updateBalance.input.parse(req.body);

    if (categoryId) {
      const cat = (await storage.getCategoriesByOrg(user.organizationId!)).find(c => c.id === categoryId);
      if (!cat) return res.status(400).json({ message: "Invalid category" });
    }

    const targetUser = await storage.getUser(id);
    if (!targetUser || targetUser.organizationId !== user.organizationId) return res.status(404).send("User not found");

    if (user.role !== "prime_admin" && amount > 0) {
      const result = await db.transaction(async (tx) => {
        const [admin] = await tx.select().from(users).where(eq(users.id, user.id)).for("update");
        if (!admin || admin.balance < amount) {
          return { error: "Insufficient balance to award Bucks" };
        }
        await tx.update(users).set({ balance: sql`${users.balance} - ${amount}` }).where(eq(users.id, user.id));
        await tx.insert(transactions).values({
          userId: user.id,
          amount: -amount,
          reason: `Bucks given to ${targetUser.fullName}`,
          performedBy: user.id,
        });
        await tx.update(users).set({ balance: sql`${users.balance} + ${amount}` }).where(eq(users.id, id));
        const [recipient] = await tx.insert(transactions).values({
          userId: id,
          amount,
          reason,
          performedBy: user.id,
          categoryId: categoryId ?? null,
        }).returning();
        const [updatedTarget] = await tx.select().from(users).where(eq(users.id, id));
        return { user: updatedTarget };
      });
      if ("error" in result) return res.status(400).json({ message: result.error });
      invalidateUserCache(user.id);
      return res.json(result.user);
    }

    if (user.role === "prime_admin" && amount > 0) {
      await storage.createTransaction({
        userId: user.id,
        amount: -amount,
        reason: `Bucks given to ${targetUser.fullName}`,
        performedBy: user.id,
      });
    }

    const updatedUser = await storage.updateUserBalance(id, amount);
    await storage.createTransaction({
      userId: id,
      amount,
      reason,
      performedBy: user.id,
      categoryId: (amount > 0 && categoryId) ? categoryId : null,
    });

    res.json(updatedUser);
  });

  app.post(api.users.updateRole.path, async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user || (user.role !== "admin" && user.role !== "prime_admin")) {
      return res.status(401).send("Unauthorized");
    }

    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).send("Invalid ID");

    const targetUser = await storage.getUser(id);
    if (!targetUser) return res.status(404).send("User not found");

    const { role } = api.users.updateRole.input.parse(req.body);

    if (targetUser.role === "prime_admin" && role !== "prime_admin") {
      if (user.role !== "prime_admin") {
        return res.status(403).send("Only a Super User can demote another Super User");
      }
      const orgUsers = await storage.getUsersByOrganization(user.organizationId!);
      const primeCount = orgUsers.filter(u => u.role === "prime_admin").length;
      if (primeCount <= 1) {
        return res.status(400).send("Cannot demote the last Super User. Promote another user first.");
      }
    }

    if (role === "prime_admin") {
      if (user.role !== "prime_admin") {
        return res.status(403).send("Only a Super User can promote others to Super User");
      }
      if (targetUser.role !== "admin") {
        return res.status(400).send("Only Admin users can be promoted to Super User");
      }
    }

    const updatedUser = await storage.updateUserRole(id, role as "admin" | "employee" | "prime_admin");
    invalidateUserCache(id);
    res.json(sanitizeUser(updatedUser));
  });

  app.patch(api.users.updateProfile.path, async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user) return res.status(401).send("Unauthorized");
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).send("Invalid ID");

    // Users can change their own, admins can change their own, Prime can change anyone's
    const isPrime = user.role === "prime_admin";
    const isAdmin = user.role === "admin" || isPrime;
    if (!isPrime && user.id !== id) {
      return res.status(403).send("Forbidden");
    }

    const data = api.users.updateProfile.input.parse(req.body);
    if (data.departmentId !== undefined && !isPrime) {
      delete (data as any).departmentId;
    }

    // If a new password is being set and the user is changing their own password
    // (not a prime admin resetting someone else's), verify the current password first.
    if (data.password) {
      const isSelfChange = user.id === id;
      if (isSelfChange) {
        if (!data.currentPassword) {
          return res.status(400).json({ message: "Current password is required to set a new password." });
        }
        const targetUser = await storage.getUser(id);
        if (!targetUser) return res.status(404).send("User not found");
        let match = await verifyPassword(data.currentPassword, targetUser.password);

        // Fallback: an authenticated user may enter their workplace Site ID in place of the
        // current password. Safe because they're already signed in as themselves and the Site
        // ID is a workplace-wide credential they're expected to know.
        if (!match && targetUser.organizationId) {
          const org = await storage.getOrganization(targetUser.organizationId);
          const entered = String(data.currentPassword).trim().toLowerCase();
          if (org?.siteId && org.siteId.toLowerCase() === entered) {
            console.log(`[Profile] User ${targetUser.id} authenticated current-password via Site ID`);
            match = true;
          }
        }

        if (!match) {
          return res.status(401).json({ message: "Current password is incorrect. Tip: you can also enter your workplace Site ID here." });
        }
      }
    }

    const profileData: any = { username: data.username, password: data.password, email: data.email };
    if (isPrime && data.departmentId !== undefined) {
      profileData.departmentId = data.departmentId;
    }
    // Users can update their own display name; prime admins can update anyone's
    if (data.fullName?.trim() && (isPrime || user.id === id)) {
      profileData.fullName = data.fullName.trim();
    }
    const updatedUser = await storage.updateUserProfile(id, profileData);
    invalidateUserCache(id);
    res.json(sanitizeUser(updatedUser));
  });

  app.delete(api.users.deleteUser.path, async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user) return res.status(401).send("Unauthorized");
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).send("Invalid ID");

    const targetUser = await storage.getUser(id);
    if (!targetUser) return res.status(404).send("User not found");

    const isPrime = user.role === "prime_admin";
    const isAdmin = user.role === "admin";

    await ensureStripeReady();

    if (targetUser.role === "prime_admin") {
      const orgUsers = await storage.getUsersByOrganization(user.organizationId!);
      const primeCount = orgUsers.filter(u => u.role === "prime_admin").length;
      if (primeCount <= 1) {
        return res.status(400).send("Cannot delete the last Super User. Promote another user first.");
      }
    }

    if (user.id === id) {
      await storage.deleteUser(id);
      req.logout(() => {});
      return res.sendStatus(200);
    }

    if (isPrime) {
      await storage.deleteUser(id);
      return res.sendStatus(200);
    }

    // Admins can delete employee accounts ONLY
    if (isAdmin && targetUser.role === "employee") {
      await storage.deleteUser(id);
      return res.sendStatus(200);
    }

    res.status(403).send("Forbidden");
  });

  // Accept terms of service
  app.post("/api/user/accept-terms", async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user) {
      return res.status(401).send("Unauthorized");
    }
    const { marketingOptIn } = z.object({ marketingOptIn: z.boolean().default(false) }).parse(req.body);
    const updated = await storage.acceptTerms(user.id, marketingOptIn);
    invalidateUserCache(user.id);
    res.json(updated);
  });

  // View own password (blocked in developer impersonation and demo modes)
  app.get("/api/user/my-password", async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    // Block if developer is impersonating (full-service view)
    if ((req.session as any).originalDeveloperUserId) {
      return res.status(403).json({ message: "Password viewing is not available in full-service view." });
    }
    if (user.role === "developer") {
      return res.status(403).json({ message: "Password viewing is not available for developer accounts." });
    }
    const fullUser = await storage.getUser(user.id);
    if (!fullUser) return res.status(404).json({ message: "User not found" });
    res.json({ password: fullUser.lastPlainPassword || null });
  });

  // Resend join email to a user (prime_admin only)
  app.post("/api/users/:id/resend-join-email", async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user || user.role !== "prime_admin") {
      return res.status(403).json({ message: "Forbidden" });
    }
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
    try {
      const target = await storage.getUser(id);
      if (!target || target.organizationId !== user.organizationId) {
        return res.status(404).json({ message: "User not found" });
      }
      if (!target.email) {
        return res.status(400).json({ message: "This account has no email address on file. Please add an email in their profile before resending." });
      }
      const org = await storage.getOrganization(user.organizationId!);
      const appUrl = getAppBaseUrl(req);
      const loginUrl = `${appUrl}/login`;
      const roleLabel = target.role === "admin" || target.role === "prime_admin"
        ? (org?.adminRoleLabel || "Admin")
        : (org?.employeeRoleLabel || "Employee");

      const userPassword = target.lastPlainPassword || org?.defaultPinPlain || null;
      const passwordLabel = "Password";

      await sendEmail({
        to: target.email,
        subject: `[Better Bucks] Your account is ready — join ${org?.name || "your organization"}`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;">
            ${emailLogoHeader}
            <h3 style="color:#4E9F3D;margin-top:0;text-align:center;">Your account is ready!</h3>
            <p>Hi ${escapeHtml(target.fullName)},</p>
            <p>Your <strong>${escapeHtml(roleLabel)}</strong> account for <strong>${escapeHtml(org?.name || "Better Bucks")}</strong> is set up and waiting for you.</p>

            <p style="font-weight:600;margin-bottom:6px;">Copy this link and paste it into your browser to sign in:</p>
            <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:14px 16px;margin:8px 0 20px 0;display:flex;align-items:center;justify-content:space-between;">
              <span style="font-family:monospace;font-size:14px;color:#111;word-break:break-all;">${escapeHtml(loginUrl)}</span>
            </div>

            <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:20px;margin:20px 0;">
              <p style="margin:0 0 12px 0;font-weight:600;font-size:14px;color:#111;">Your login details:</p>
              <table style="width:100%;border-collapse:collapse;">
                <tr><td style="padding:6px 0;color:#6b7280;font-size:13px;width:110px;">Username</td><td style="padding:6px 0;font-weight:700;color:#111;font-family:monospace;font-size:15px;">${escapeHtml(target.username)}</td></tr>
                ${userPassword ? `<tr><td style="padding:6px 0;color:#6b7280;font-size:13px;">${passwordLabel}</td><td style="padding:6px 0;font-weight:700;color:#111;font-family:monospace;font-size:15px;">${escapeHtml(userPassword)}</td></tr>` : ""}
              </table>
            </div>
            ${!userPassword ? `<p style="color:#6b7280;font-size:13px;">A password has not been set for your account yet. Contact your administrator to receive your password.</p>` : `<p style="color:#6b7280;font-size:13px;">We recommend changing your password after your first login.</p>`}
            <p style="color:#9ca3af;font-size:12px;text-align:center;margin-top:24px;">Sent by ${escapeHtml(user.fullName)} from ${escapeHtml(org?.name || "Better Bucks")}.</p>
          </div>
        `,
      });
      res.json({ message: "Join email sent successfully." });
    } catch (e) {
      console.error("Error resending join email:", e);
      res.status(500).json({ message: "Failed to send email" });
    }
  });

  app.post("/api/users/:id/approve", async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user || user.role !== "prime_admin") {
      return res.status(401).send("Unauthorized");
    }
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).send("Invalid ID");
    
    try {
      const targetUser = await storage.getUser(id);
      if (!targetUser || (user.organizationId && targetUser.organizationId !== user.organizationId)) {
        return res.status(404).json({ message: "User not found" });
      }
      // Optionally update role before approving
      const roleRaw = req.body?.role;
      const validRoles = ["employee", "admin", "prime_admin"] as const;
      const newRole = validRoles.includes(roleRaw) ? roleRaw as typeof validRoles[number] : null;
      if (newRole && newRole !== targetUser.role) {
        await storage.updateUserRole(id, newRole);
      }
      const approvedUser = await storage.approveAdminUser(id);
      res.json(approvedUser);
    } catch (error) {
      console.error("Error approving user:", error);
      res.status(500).send("Internal Server Error");
    }
  });

  // Transfer Super User (prime_admin) role to another org user
  app.post("/api/organizations/transfer-super-user", async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user || user.role !== "prime_admin") {
      return res.status(403).json({ message: "Only the current Super User can transfer this role." });
    }
    const parsed = z.object({ targetUserId: z.number().int() }).safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid request. Please select a valid user." });
    }
    const { targetUserId } = parsed.data;
    if (targetUserId === user.id) {
      return res.status(400).json({ message: "You already hold the Super User role." });
    }
    const target = await storage.getUser(targetUserId);
    if (!target || target.organizationId !== user.organizationId) {
      return res.status(404).json({ message: "User not found in your organization." });
    }
    if (target.status !== "approved") {
      return res.status(400).json({ message: "Target user must be approved before receiving the Super User role." });
    }
    try {
      // Atomic transfer: promote target and demote self in a single transaction
      await db.transaction(async (tx) => {
        await tx.update(users).set({ role: "prime_admin" }).where(eq(users.id, targetUserId));
        await tx.update(users).set({ role: "admin" }).where(eq(users.id, user.id));
      });
      res.json({ message: "Super User role transferred successfully." });
    } catch (e) {
      console.error("Super User transfer error:", e);
      res.status(500).json({ message: "Transfer failed. No changes were made." });
    }
  });

  // Reject/Delete pending user (prime account only)
  app.delete("/api/users/:id/reject", async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user || user.role !== "prime_admin") {
      return res.status(401).send("Unauthorized");
    }
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).send("Invalid ID");
    
    await storage.deleteUser(id);
    res.sendStatus(200);
  });

  // Transactions
  app.get(api.transactions.list.path, async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user) return res.status(401).send("Unauthorized");
    
    if (user.role === "admin" || user.role === "prime_admin") {
      const txs = await storage.getAllTransactions();
      res.json(txs);
    } else {
      const txs = await storage.getTransactionsByUser(user.id);
      res.json(txs);
    }
  });

  // Serve uploaded files (auth-gated)
  app.use("/uploads", (req, res, next) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user) return res.status(401).send("Unauthorized");
    next();
  }, (await import("express")).default.static(uploadDir));

  // Serve blog images publicly (no auth — blog posts are public)
  app.use("/blog-images", (await import("express")).default.static(blogImageDir));

  // Developer: upload a hero image for blog posts (stored as base64 data URL in DB — no filesystem dependency)
  app.post("/api/developer/blog-image", (req, res, next) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user || user.role !== "developer") return res.status(401).send("Unauthorized");
    next();
  }, async (req: any, res: any, next: any) => {
    const multer = (await import("multer")).default;
    const blogImageUpload = multer({
      storage: multer.memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_req: any, file: any, cb: any) => {
        if (file.mimetype.startsWith("image/")) {
          cb(null, true);
        } else {
          cb(new Error("Only image files are allowed"));
        }
      },
    });
    blogImageUpload.single("image")(req, res, next);
  }, (req: any, res: any) => {
    if (!req.file) return res.status(400).json({ message: "No image uploaded" });
    const dataUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
    res.json({ url: dataUrl });
  });

  // Upload photos
  app.post("/api/upload", (req, res, next) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user) return res.status(401).send("Unauthorized");
    next();
  }, async (req, res, next) => { const u = await getUpload(); u.any()(req, res, next); }, (req: any, res: any) => {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) return res.status(400).json({ message: "No files uploaded" });
    const urls = files.map(f => `/uploads/${f.filename}`);
    res.json(urls);
  });

  // Orders
  const createOrderSchema = z.object({
    description: z.string().min(1, "Description is required"),
    photoUrls: z.array(z.string()).default([]),
    itemUrl: z.string().url().optional().or(z.literal("")),
    pointsCost: z.number().int().positive("Bucks must be greater than 0"),
    shopWebsiteId: z.number().int({ required_error: "Shop website is required" }),
  }).refine(
    (data) => data.photoUrls.length > 0 || (data.itemUrl && data.itemUrl.length > 0),
    { message: "Please provide at least one photo or a link to the item" }
  );

  app.post("/api/orders", async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user) return res.status(401).send("Unauthorized");
    if (user.role !== "employee") return res.status(403).json({ message: "Only employees can place orders" });

    try {
      const parsed = createOrderSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0].message });
      const { description, photoUrls, itemUrl, pointsCost, shopWebsiteId } = parsed.data;

      if (user.balance < pointsCost) {
        return res.status(400).json({ message: "Insufficient Bucks balance" });
      }

      let convertedValue: string | null = null;
      if (shopWebsiteId) {
        const shop = await storage.getShopWebsite(shopWebsiteId);
        if (shop && shop.pointsPerDollar > 0) {
          const dollars = (pointsCost / shop.pointsPerDollar).toFixed(2);
          convertedValue = `$${dollars} on ${shop.name}`;
        }
      }

      const order = await storage.createOrder({
        userId: user.id,
        pointsCost,
        description,
        photoUrls,
        itemUrl: itemUrl || null,
        shopWebsiteId: shopWebsiteId || null,
        convertedValue,
      });

      await storage.updateUserBalance(user.id, -pointsCost);
      await storage.createTransaction({
        userId: user.id,
        amount: -pointsCost,
        reason: `Order #${order.id}: ${description}`,
      });

      res.status(201).json(order);
    } catch (e) {
      console.error("Order creation error:", e);
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.get("/api/orders", async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user) return res.status(401).send("Unauthorized");

    if (user.role === "admin" || user.role === "prime_admin") {
      const allOrders = user.organizationId
        ? await storage.getOrdersByOrganization(user.organizationId)
        : await storage.getAllOrders();
      res.json(allOrders);
    } else {
      const userOrders = await storage.getOrdersByUser(user.id);
      res.json(userOrders);
    }
  });

  const updateOrderStatusSchema = z.object({
    status: z.enum(["approved", "rejected", "completed"]),
    adminNotes: z.string().optional(),
  });

  app.patch("/api/orders/:id/status", async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user || user.role !== "prime_admin") {
      return res.status(403).json({ message: "Only the Organization Owner can approve or reject orders." });
    }

    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).send("Invalid ID");

    const parsed = updateOrderStatusSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0].message });
    const { status, adminNotes } = parsed.data;

    const order = await storage.getOrder(id);
    if (!order) return res.status(404).send("Order not found");

    const orderOwner = await storage.getUser(order.userId);
    if (!orderOwner || orderOwner.organizationId !== user.organizationId) {
      return res.status(404).send("Order not found");
    }

    if (status === "rejected" && order.status === "pending") {
      await storage.updateUserBalance(order.userId, order.pointsCost);
      await storage.createTransaction({
        userId: order.userId,
        amount: order.pointsCost,
        reason: `Order #${order.id} rejected - Bucks refunded`,
      });
    }

    const updated = await storage.updateOrderStatus(id, status, adminNotes);
    res.json(updated);
  });

  // Adjust Bucks amount on an order (prime_admin only)
  app.patch("/api/orders/:id/bucks", async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user || user.role !== "prime_admin") {
      return res.status(403).json({ message: "Only the Organization Owner can adjust order Bucks." });
    }

    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).send("Invalid ID");

    const parsed = z.object({ newCost: z.number().int().min(1, "Bucks must be at least 1") }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0].message });

    const order = await storage.getOrder(id);
    if (!order) return res.status(404).send("Order not found");

    const orderOwner = await storage.getUser(order.userId);
    if (!orderOwner || orderOwner.organizationId !== user.organizationId) {
      return res.status(404).send("Order not found");
    }

    if (order.status === "rejected") {
      return res.status(400).json({ message: "Cannot adjust Bucks on a rejected order." });
    }

    const { newCost } = parsed.data;
    const diff = newCost - order.pointsCost;

    if (diff !== 0) {
      // Adjust employee balance: negative diff = refund, positive diff = extra charge
      await storage.updateUserBalance(order.userId, -diff);
      await storage.createTransaction({
        userId: order.userId,
        amount: -diff,
        reason: diff > 0
          ? `Order #${order.id} Bucks adjusted (+${diff} charged)`
          : `Order #${order.id} Bucks adjusted (${diff} refunded)`,
        performedBy: user.id,
      });
    }

    const updated = await storage.updateOrderPointsCost(id, newCost);
    res.json(updated);
  });

  // Points distribution stats (admin only) - counts bucks given from admins to employees
  app.get("/api/stats/points", async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user || (user.role !== "admin" && user.role !== "prime_admin")) {
      return res.status(401).send("Unauthorized");
    }
    if (!user.organizationId) return res.status(400).json({ message: "No organization" });

    let orgUsers = await storage.getUsersByOrganization(user.organizationId);
    const deptIdParam = req.query.departmentId ? parseInt(req.query.departmentId as string) : null;
    if (deptIdParam !== null) {
      orgUsers = orgUsers.filter(u => u.departmentId === deptIdParam);
    }
    const mgrIdParam = req.query.managerId ? parseInt(req.query.managerId as string) : null;
    if (mgrIdParam !== null) {
      orgUsers = orgUsers.filter(u => u.managerId === mgrIdParam);
    }
    const employeeIds = orgUsers.filter(u => u.role === "employee").map(u => u.id);
    const adminIds = orgUsers.filter(u => u.role === "admin" || u.role === "prime_admin").map(u => u.id);

    if (employeeIds.length === 0 || adminIds.length === 0) {
      return res.json({ week: 0, month: 0, year: 0, weekDebited: 0, monthDebited: 0, yearDebited: 0 });
    }

    const adminIdFilter = req.query.adminId ? parseInt(req.query.adminId as string) : null;
    const performedByFilter = adminIdFilter
      ? eq(transactions.performedBy, adminIdFilter)
      : inArray(transactions.performedBy, adminIds);

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
    const yearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());

    // Single query replacing 6 — conditional aggregation with CASE WHEN
    const [row] = await db.select({
      week:         sql<number>`COALESCE(SUM(CASE WHEN ${transactions.amount} > 0 AND ${transactions.createdAt} >= ${weekAgo}  AND (${performedByFilter}) THEN ${transactions.amount} END), 0)`,
      month:        sql<number>`COALESCE(SUM(CASE WHEN ${transactions.amount} > 0 AND ${transactions.createdAt} >= ${monthAgo} AND (${performedByFilter}) THEN ${transactions.amount} END), 0)`,
      year:         sql<number>`COALESCE(SUM(CASE WHEN ${transactions.amount} > 0 AND ${transactions.createdAt} >= ${yearAgo}  AND (${performedByFilter}) THEN ${transactions.amount} END), 0)`,
      weekDebited:  sql<number>`COALESCE(SUM(CASE WHEN ${transactions.amount} < 0 AND ${transactions.createdAt} >= ${weekAgo}  THEN ABS(${transactions.amount}) END), 0)`,
      monthDebited: sql<number>`COALESCE(SUM(CASE WHEN ${transactions.amount} < 0 AND ${transactions.createdAt} >= ${monthAgo} THEN ABS(${transactions.amount}) END), 0)`,
      yearDebited:  sql<number>`COALESCE(SUM(CASE WHEN ${transactions.amount} < 0 AND ${transactions.createdAt} >= ${yearAgo}  THEN ABS(${transactions.amount}) END), 0)`,
    }).from(transactions)
      .where(and(
        inArray(transactions.userId, employeeIds),
        gte(transactions.createdAt, yearAgo),
      ));

    res.json({
      week: Number(row.week),
      month: Number(row.month),
      year: Number(row.year),
      weekDebited: Number(row.weekDebited),
      monthDebited: Number(row.monthDebited),
      yearDebited: Number(row.yearDebited),
    });
  });

  app.get("/api/stats/orders", async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user || (user.role !== "admin" && user.role !== "prime_admin")) {
      return res.status(401).send("Unauthorized");
    }
    if (!user.organizationId) return res.status(400).json({ message: "No organization" });

    let orgUsers = await storage.getUsersByOrganization(user.organizationId);
    const deptIdParam = req.query.departmentId ? parseInt(req.query.departmentId as string) : null;
    if (deptIdParam !== null) {
      orgUsers = orgUsers.filter(u => u.departmentId === deptIdParam);
    }
    const mgrIdParamO = req.query.managerId ? parseInt(req.query.managerId as string) : null;
    if (mgrIdParamO !== null) {
      orgUsers = orgUsers.filter(u => u.managerId === mgrIdParamO);
    }
    const employeeIds = orgUsers.filter(u => u.role === "employee").map(u => u.id);

    const emptyStats = { totalOrders: 0, pendingDollars: "$0.00", approvedDollars: "$0.00", totalDollars: "$0.00" };
    if (employeeIds.length === 0) {
      return res.json({ week: emptyStats, month: emptyStats, year: emptyStats });
    }

    const allOrders = await db.select().from(orders).where(inArray(orders.userId, employeeIds));

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
    const yearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());

    const calcStats = (filtered: typeof allOrders) => {
      let total = filtered.length;
      let pendingDollars = 0;
      let approvedDollars = 0;
      let totalDollars = 0;
      for (const order of filtered) {
        const dollarAmount = order.convertedValue ? parseFloat(order.convertedValue.replace(/[^0-9.]/g, "")) || 0 : 0;
        totalDollars += dollarAmount;
        if (order.status === "pending") pendingDollars += dollarAmount;
        if (order.status === "approved" || order.status === "completed") approvedDollars += dollarAmount;
      }
      return {
        totalOrders: total,
        pendingDollars: `$${pendingDollars.toFixed(2)}`,
        approvedDollars: `$${approvedDollars.toFixed(2)}`,
        totalDollars: `$${totalDollars.toFixed(2)}`,
      };
    };

    const weekOrders = allOrders.filter(o => new Date(o.createdAt) >= weekAgo);
    const monthOrders = allOrders.filter(o => new Date(o.createdAt) >= monthAgo);
    const yearOrders = allOrders.filter(o => new Date(o.createdAt) >= yearAgo);

    res.json({
      week: calcStats(weekOrders),
      month: calcStats(monthOrders),
      year: calcStats(yearOrders),
    });
  });

  // Time-series stats for line charts on the dashboard
  app.get("/api/stats/timeseries", async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user || (user.role !== "admin" && user.role !== "prime_admin")) {
      return res.status(401).send("Unauthorized");
    }
    if (!user.organizationId) return res.status(400).json({ message: "No organization" });

    const type = req.query.type as string;      // "credited" | "debited" | "orders"
    const period = (req.query.period as string) || "week"; // "week" | "month" | "year"

    let orgUsers = await storage.getUsersByOrganization(user.organizationId);
    const deptIdParam = req.query.departmentId ? parseInt(req.query.departmentId as string) : null;
    if (deptIdParam !== null) {
      orgUsers = orgUsers.filter(u => u.departmentId === deptIdParam);
    }
    const employeeIds = orgUsers.filter(u => u.role === "employee").map(u => u.id);
    const adminIds = orgUsers.filter(u => u.role === "admin" || u.role === "prime_admin").map(u => u.id);

    const adminIdFilter = req.query.adminId ? parseInt(req.query.adminId as string) : null;
    const performedByFilter = adminIdFilter
      ? eq(transactions.performedBy, adminIdFilter)
      : adminIds.length > 0 ? inArray(transactions.performedBy, adminIds) : sql`false`;

    const now = new Date();

    // Build the bucket labels and date range
    type Bucket = { label: string; key: string; start: Date; end: Date };
    let buckets: Bucket[] = [];

    if (period === "week") {
      // Last 7 days including today
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
        const end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
        buckets.push({
          label: start.toLocaleDateString("en-US", { weekday: "short" }),
          key: start.toISOString().split("T")[0],
          start,
          end,
        });
      }
    } else if (period === "month") {
      // Last 30 days including today
      for (let i = 29; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
        const end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
        buckets.push({
          label: `${start.getMonth() + 1}/${start.getDate()}`,
          key: start.toISOString().split("T")[0],
          start,
          end,
        });
      }
    } else {
      // "year" — 12 months of current year
      const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      for (let i = 0; i < 12; i++) {
        const start = new Date(now.getFullYear(), i, 1, 0, 0, 0, 0);
        const end = new Date(now.getFullYear(), i + 1, 0, 23, 59, 59, 999);
        buckets.push({
          label: MONTHS[i],
          key: `${now.getFullYear()}-${String(i + 1).padStart(2, "0")}`,
          start,
          end,
        });
      }
    }

    const overallStart = buckets[0].start;
    const overallEnd = buckets[buckets.length - 1].end;

    const dataMap: Record<string, number> = {};

    if ((type === "credited" || type === "debited") && employeeIds.length > 0 && adminIds.length > 0) {
      const amountCondition = type === "credited" ? gt(transactions.amount, 0) : lt(transactions.amount, 0);
      const rows = await db.select({
        createdAt: transactions.createdAt,
        amount: transactions.amount,
      }).from(transactions).where(and(
        inArray(transactions.userId, employeeIds),
        amountCondition,
        type === "credited" ? performedByFilter : sql`true`,
        gte(transactions.createdAt, overallStart),
        lte(transactions.createdAt, overallEnd),
      ));

      for (const row of rows) {
        const d = new Date(row.createdAt);
        let key: string;
        if (period === "year") {
          key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        } else {
          key = d.toISOString().split("T")[0];
        }
        const val = Math.abs(Number(row.amount));
        dataMap[key] = (dataMap[key] || 0) + val;
      }
    } else if (type === "orders" && employeeIds.length > 0) {
      const orderRows = await db.select({
        createdAt: orders.createdAt,
      }).from(orders).where(and(
        inArray(orders.userId, employeeIds),
        gte(orders.createdAt, overallStart),
        lte(orders.createdAt, overallEnd),
      ));

      for (const row of orderRows) {
        const d = new Date(row.createdAt);
        let key: string;
        if (period === "year") {
          key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        } else {
          key = d.toISOString().split("T")[0];
        }
        dataMap[key] = (dataMap[key] || 0) + 1;
      }
    }

    const result = buckets.map(b => ({ label: b.label, value: dataMap[b.key] || 0 }));
    res.json(result);
  });

  // Get admins for the current organization (for dashboard filter)
  app.get("/api/org/admins", async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user || (user.role !== "admin" && user.role !== "prime_admin")) {
      return res.status(401).send("Unauthorized");
    }
    if (!user.organizationId) return res.status(400).json({ message: "No organization" });

    const admins = await db.select({ id: users.id, fullName: users.fullName, role: users.role })
      .from(users)
      .where(and(
        eq(users.organizationId, user.organizationId),
        inArray(users.role, ["admin", "prime_admin"]),
      ))
      .orderBy(users.fullName);

    res.json(admins);
  });

  // Stripe publishable key (public)
  app.get("/api/stripe/publishable-key", async (_req, res) => {
    try {
      await ensureStripeReady();
      const key = await getStripePubKey();
      res.json({ publishableKey: key });
    } catch (error) {
      console.error("Error getting Stripe key:", error);
      res.status(500).json({ message: "Could not load payment configuration" });
    }
  });

  // Tier pricing configuration
  const tierConfig = {
    small:      { price: 4999,  maxEmployees: 25,  name: "Small Site",      description: "Up to 25 employees — includes 60-day free pilot, admin dashboard, Bucks tracking, basic reporting, and email support." },
    mid:        { price: 9999,  maxEmployees: 75,  name: "Mid-Size Site",   description: "26–75 employees — includes 60-day free pilot, admin dashboard, Bucks tracking, advanced reporting, and priority support." },
    large:      { price: 14999, maxEmployees: 150, name: "Large Site",      description: "76–150 employees — includes 60-day free pilot, admin dashboard, Bucks tracking, advanced reporting, and priority support." },
    enterprise: { price: 29999, maxEmployees: -1,  name: "Enterprise Site", description: "150+ employees — includes 60-day free pilot, unlimited logins, admin dashboard, Bucks tracking, custom reporting, and dedicated support." },
  } as const;

  // Organization signup - create checkout session
  const signupSchema = z.object({
    organizationName: z.string().min(2, "Organization name is required"),
    email: z.string().email("Valid email is required"),
    tier: z.enum(["small", "mid", "large", "enterprise"]),
    referralCode: z.string().optional(),
    licenseAccepted: z.boolean().refine(v => v === true, { message: "You must agree to the Terms of Service and Software License Agreement to proceed." }),
    marketingOptIn: z.boolean().optional().default(false),
  });

  // Shared helper: build and send a signup notification email to the admin
  async function sendSignupNotificationEmail({
    organizationName, email, tier, config, orgCode, referralCode, mode,
  }: {
    organizationName: string; email: string; tier: string;
    config: { name: string; maxEmployees: number };
    orgCode: string; referralCode?: string; mode: "stripe" | "contactPending" | "promo";
  }) {
    const planPrices: Record<string, string> = {
      small: "$49.99/mo", mid: "$99.99/mo", large: "$149.99/mo", enterprise: "$299.99/mo",
    };

    let validatedReferral: { code: string; extraMonths: number } | null = null;
    if (referralCode && referralCode.trim()) {
      const refRow = await storage.getReferralCode(referralCode.trim());
      if (refRow && refRow.active) validatedReferral = { code: refRow.code, extraMonths: refRow.extraMonths };
    }

    const modeLabel = mode === "stripe" ? "💳 NEW STRIPE SUBSCRIPTION" : mode === "promo" ? "🎟️ PROMO CODE SIGNUP (GOKU11)" : "⭐ FOUNDER PRICING REQUEST";
    const referralRow = validatedReferral
      ? `<tr><td style="padding:8px 12px;font-weight:600;color:#fff;background:#1d6a2e;border:1px solid #166534">🎁 Referral Code</td><td style="padding:8px 12px;background:#dcfce7;border:1px solid #166534;font-weight:700;color:#166534">${escapeHtml(validatedReferral.code)} — +${validatedReferral.extraMonths} free month${validatedReferral.extraMonths > 1 ? "s" : ""}</td></tr>`
      : referralCode && referralCode.trim()
        ? `<tr><td style="padding:8px 12px;font-weight:600;color:#374151;background:#fff;border:1px solid #e5e7eb">Referral Code</td><td style="padding:8px 12px;background:#fff;border:1px solid #e5e7eb;color:#dc2626">${escapeHtml(referralCode.trim())} (invalid)</td></tr>`
        : "";
    const referralText = validatedReferral
      ? `\nReferral Code: ${validatedReferral.code} ✅ (+${validatedReferral.extraMonths} free month${validatedReferral.extraMonths > 1 ? "s" : ""})`
      : referralCode?.trim() ? `\nReferral Code: ${referralCode.trim()} (invalid)` : "";

    sendEmail({
      to: ADMIN_NOTIFY_EMAIL,
      subject: `${modeLabel} – ${config.name} – ${organizationName}${validatedReferral ? " 🎁" : ""}`,
      html: `<div style="font-family:sans-serif;max-width:520px">
<div style="background:#162A4A;color:#fff;padding:16px 20px;border-radius:8px 8px 0 0;text-align:center">
  <img src="${EMAIL_LOGO_URL}" alt="Better Bucks" width="48" height="48" style="display:block;margin:0 auto 8px;" />
  <h2 style="margin:0;font-size:20px">${modeLabel}</h2>
</div>
<div style="background:#f9fafb;padding:20px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px">
  <table style="border-collapse:collapse;width:100%">
    <tr><td style="padding:8px 12px;font-weight:600;color:#374151;background:#fff;border:1px solid #e5e7eb;width:38%">Company</td><td style="padding:8px 12px;background:#fff;border:1px solid #e5e7eb">${escapeHtml(organizationName)}</td></tr>
    <tr><td style="padding:8px 12px;font-weight:600;color:#374151;background:#f9fafb;border:1px solid #e5e7eb">Contact Email</td><td style="padding:8px 12px;background:#f9fafb;border:1px solid #e5e7eb"><a href="mailto:${escapeHtml(email)}" style="color:#162A4A">${escapeHtml(email)}</a></td></tr>
    <tr><td style="padding:8px 12px;font-weight:600;color:#374151;background:#fff;border:1px solid #e5e7eb">Plan</td><td style="padding:8px 12px;background:#fff;border:1px solid #e5e7eb"><strong>${escapeHtml(config.name)}</strong></td></tr>
    <tr><td style="padding:8px 12px;font-weight:600;color:#374151;background:#f9fafb;border:1px solid #e5e7eb">Monthly Rate</td><td style="padding:8px 12px;background:#f9fafb;border:1px solid #e5e7eb">${planPrices[tier]}</td></tr>
    <tr><td style="padding:8px 12px;font-weight:600;color:#374151;background:#fff;border:1px solid #e5e7eb">Employee Limit</td><td style="padding:8px 12px;background:#fff;border:1px solid #e5e7eb">${config.maxEmployees === -1 ? "Unlimited (Enterprise)" : `Up to ${config.maxEmployees} employees`}</td></tr>
    <tr><td style="padding:8px 12px;font-weight:600;color:#374151;background:#f9fafb;border:1px solid #e5e7eb">Org Code</td><td style="padding:8px 12px;background:#f9fafb;border:1px solid #e5e7eb;font-family:monospace;font-weight:700">${escapeHtml(orgCode)}</td></tr>
    ${referralRow}
    <tr><td style="padding:8px 12px;font-weight:600;color:#374151;background:#fff;border:1px solid #e5e7eb">Submitted</td><td style="padding:8px 12px;background:#fff;border:1px solid #e5e7eb">${new Date().toLocaleString("en-US", { timeZone: "America/Chicago" })} CT</td></tr>
  </table>
  ${mode === "stripe" ? '<p style="margin-top:16px;color:#374151">Customer has been sent to the Stripe payment page to complete their subscription setup.</p>' : mode === "contactPending" ? '<p style="margin-top:16px;color:#374151">Reach out to them to complete their onboarding and lock in their rate.</p>' : '<p style="margin-top:16px;color:#374151">Promo code applied — account activated immediately.</p>'}
</div>
</div>`,
      text: `${modeLabel}\n\nCompany: ${organizationName}\nContact Email: ${email}\nPlan: ${config.name}\nMonthly Rate: ${planPrices[tier]}\nEmployee Limit: ${config.maxEmployees === -1 ? "Unlimited (Enterprise)" : `Up to ${config.maxEmployees}`}\nOrg Code: ${orgCode}${referralText}\nSubmitted: ${new Date().toLocaleString("en-US", { timeZone: "America/Chicago" })} CT`,
    }).catch(err => console.error("[Email] Failed to send signup notification:", err));

    return validatedReferral;
  }

  app.post("/api/organizations/signup", async (req, res) => {
    try {
      const { organizationName, email, tier, referralCode, marketingOptIn } = signupSchema.parse(req.body);
      const config = tierConfig[tier];

      const isPromoSignup = !!(referralCode && referralCode.trim().toUpperCase() === "GOKU11");

      // Check if Stripe is ready (live keys take priority via stripeClient.ts)
      let stripeReady = false;
      if (!isPromoSignup) {
        try {
          await ensureStripeReady();
          await getStripeClient();
          stripeReady = true;
        } catch {
          stripeReady = false;
        }
      }

      // If Stripe is not configured, send a lead notification and respond gracefully
      if (!isPromoSignup && !stripeReady) {
        const orgCode = crypto.randomBytes(4).toString("hex").toUpperCase();

        // Validate referral code and send the notification email
        let validatedReferral: { code: string; extraMonths: number } | null = null;
        if (referralCode && referralCode.trim()) {
          const refRow = await storage.getReferralCode(referralCode.trim());
          if (refRow && refRow.active) validatedReferral = { code: refRow.code, extraMonths: refRow.extraMonths };
        }

        const referralRow = validatedReferral
          ? `<tr><td style="padding:8px 12px;font-weight:600;color:#fff;background:#1d6a2e;border:1px solid #166534">🎁 Referral Code</td><td style="padding:8px 12px;background:#dcfce7;border:1px solid #166534;font-weight:700;color:#166534">${escapeHtml(validatedReferral.code)} — +${validatedReferral.extraMonths} free month${validatedReferral.extraMonths > 1 ? "s" : ""}</td></tr>`
          : referralCode && referralCode.trim()
            ? `<tr><td style="padding:8px 12px;font-weight:600;color:#374151;background:#fff;border:1px solid #e5e7eb">Referral Code</td><td style="padding:8px 12px;background:#fff;border:1px solid #e5e7eb;color:#dc2626">${escapeHtml(referralCode.trim())} (invalid)</td></tr>`
            : "";
        const referralText = validatedReferral
          ? `\nReferral Code: ${validatedReferral.code} ✅ (+${validatedReferral.extraMonths} free month${validatedReferral.extraMonths > 1 ? "s" : ""})`
          : referralCode?.trim() ? `\nReferral Code: ${referralCode.trim()} (invalid)` : "";
        const planPrices: Record<string, string> = { small: "$49.99/mo", mid: "$99.99/mo", large: "$149.99/mo", enterprise: "$299.99/mo" };

        sendEmail({
          to: ADMIN_NOTIFY_EMAIL,
          subject: `⭐ FOUNDER PRICING REQUEST – ${config.name} – ${organizationName}${validatedReferral ? " 🎁 Referral" : ""}`,
          html: `<div style="font-family:sans-serif;max-width:520px">
<div style="background:#162A4A;color:#fff;padding:16px 20px;border-radius:8px 8px 0 0;text-align:center">
  <img src="${EMAIL_LOGO_URL}" alt="Better Bucks" width="48" height="48" style="display:block;margin:0 auto 8px;" />
  <h2 style="margin:0;font-size:20px">⭐ New Founder Pricing Request</h2>
</div>
<div style="background:#f9fafb;padding:20px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px">
  <table style="border-collapse:collapse;width:100%">
    <tr><td style="padding:8px 12px;font-weight:600;color:#374151;background:#fff;border:1px solid #e5e7eb;width:38%">Company</td><td style="padding:8px 12px;background:#fff;border:1px solid #e5e7eb">${escapeHtml(organizationName)}</td></tr>
    <tr><td style="padding:8px 12px;font-weight:600;color:#374151;background:#f9fafb;border:1px solid #e5e7eb">Contact Email</td><td style="padding:8px 12px;background:#f9fafb;border:1px solid #e5e7eb"><a href="mailto:${escapeHtml(email)}" style="color:#162A4A">${escapeHtml(email)}</a></td></tr>
    <tr><td style="padding:8px 12px;font-weight:600;color:#374151;background:#fff;border:1px solid #e5e7eb">Pricing Level</td><td style="padding:8px 12px;background:#fff;border:1px solid #e5e7eb"><strong>FOUNDER PRICING – ${escapeHtml(config.name)}</strong></td></tr>
    <tr><td style="padding:8px 12px;font-weight:600;color:#374151;background:#f9fafb;border:1px solid #e5e7eb">Monthly Rate</td><td style="padding:8px 12px;background:#f9fafb;border:1px solid #e5e7eb">${planPrices[tier]} (locked in forever)</td></tr>
    <tr><td style="padding:8px 12px;font-weight:600;color:#374151;background:#fff;border:1px solid #e5e7eb">Employee Limit</td><td style="padding:8px 12px;background:#fff;border:1px solid #e5e7eb">${config.maxEmployees === -1 ? "Unlimited (Enterprise)" : `Up to ${config.maxEmployees} employees`}</td></tr>
    ${referralRow}
    <tr><td style="padding:8px 12px;font-weight:600;color:#374151;background:#f9fafb;border:1px solid #e5e7eb">Submitted</td><td style="padding:8px 12px;background:#f9fafb;border:1px solid #e5e7eb">${new Date().toLocaleString("en-US", { timeZone: "America/Chicago" })} CT</td></tr>
  </table>
  <p style="margin-top:16px;color:#374151">Reach out to them to complete their onboarding and lock in their founder rate.</p>
</div>
</div>`,
          text: `⭐ FOUNDER PRICING REQUEST\n\nCompany: ${organizationName}\nContact Email: ${email}\nPricing Level: FOUNDER PRICING – ${config.name}\nMonthly Rate: ${planPrices[tier]} (locked in forever)\nEmployee Limit: ${config.maxEmployees === -1 ? "Unlimited (Enterprise)" : `Up to ${config.maxEmployees}`}${referralText}\nSubmitted: ${new Date().toLocaleString("en-US", { timeZone: "America/Chicago" })} CT`,
        }).catch(err => console.error("[Email] Failed to send founder lead notification:", err));

        return res.json({ contactPending: true, referralValid: !!validatedReferral, referralExtraMonths: validatedReferral?.extraMonths });
      }

      const orgCode = crypto.randomBytes(4).toString("hex").toUpperCase();

      const org = await storage.createOrganization({
        name: organizationName,
        code: orgCode,
        tier,
        maxEmployees: config.maxEmployees,
        licenseAcceptedAt: new Date(),
        marketingOptIn: marketingOptIn ?? false,
      });

      // Alert when the 45th company signs up (5 slots left for founder pricing)
      const allOrgs = await storage.getAllOrganizations();
      if (allOrgs.length === 45) {
        sendEmail({
          to: ADMIN_NOTIFY_EMAIL,
          subject: "🚨 Better Bucks: 45 Companies Signed Up – 5 Founder Spots Left!",
          html: `<p>Hi Miles,</p>
<p>The <strong>45th company</strong> just signed up for Better Bucks — only <strong>5 founder pricing spots remain</strong>.</p>
<p><strong>Company:</strong> ${escapeHtml(organizationName)}<br/><strong>Tier:</strong> ${escapeHtml(config.name)}<br/><strong>Org Code:</strong> ${escapeHtml(orgCode)}</p>
<p>Consider promoting the scarcity to drive conversions.</p>
<p>— Better Bucks System</p>`,
          text: `45 companies have signed up. Only 5 founder pricing spots remain. Latest signup: ${organizationName} (${config.name}, code: ${orgCode}).`,
        }).catch(err => console.error("[Email] Failed to send 45-org alert:", err));
      }

      if (isPromoSignup) {
        await storage.updateOrganizationStripe(org.id, "promo_GOKU11", "promo_GOKU11");
        await storage.updateOrganizationStatus(org.id, "active");
        await storage.updateOrganizationSignupPrice(org.id, config.price);
        sendSignupNotificationEmail({ organizationName, email, tier, config, orgCode, referralCode, mode: "promo" });
        return res.json({ promoApplied: true, orgCode });
      }

      const stripe = await getStripeClient();

      const customer = await stripe.customers.create({
        email,
        name: organizationName,
        metadata: { organizationId: String(org.id), organizationName, tier },
      });

      const baseUrl = getAppBaseUrl(req);

      // Build trial period: validate referral code and add bonus months
      let validatedReferral: { code: string; extraMonths: number } | null = null;
      if (referralCode && referralCode.trim()) {
        const refRow = await storage.getReferralCode(referralCode.trim());
        if (refRow && refRow.active) {
          validatedReferral = { code: refRow.code, extraMonths: refRow.extraMonths };
        } else {
          // Code was provided but is not valid — block the signup
          return res.status(400).json({ message: "That referral code isn't valid. Double-check it and try again, or leave the field blank to continue without one." });
        }
      }
      const trialDays = 60 + (validatedReferral ? validatedReferral.extraMonths * 30 : 0);

      const trialMonths = Math.round(trialDays / 30);
      const trialLabel = trialMonths === 1 ? "1 month" : `${trialMonths} months`;
      const referralNote = validatedReferral
        ? ` Your referral code (${validatedReferral.code}) added +${validatedReferral.extraMonths} extra free month${validatedReferral.extraMonths > 1 ? "s" : ""}.`
        : "";

      const session = await stripe.checkout.sessions.create({
        customer: customer.id,
        payment_method_types: ['card'],
        line_items: [{
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Better Bucks – ${config.name}`,
              description: config.description,
              metadata: { tier },
            },
            unit_amount: config.price,
            recurring: { interval: 'month' },
            tax_behavior: 'exclusive',
          },
          quantity: 1,
        }],
        mode: 'subscription',
        automatic_tax: { enabled: true },
        subscription_data: {
          trial_period_days: trialDays,
          trial_settings: { end_behavior: { missing_payment_method: 'cancel' } },
          metadata: { organizationId: String(org.id), tier, orgCode },
          description: `Better Bucks ${config.name} — ${trialLabel} free trial, then $${(config.price / 100).toFixed(2)}/month + applicable taxes.${referralNote}`,
        },
        payment_method_collection: 'always',
        consent_collection: { terms_of_service: 'required' },
        custom_text: {
          submit: {
            message: `Your card won't be charged until after your ${trialLabel} free trial ends. Applicable sales tax will be added based on your location.${referralNote}`,
          },
          terms_of_service_acceptance: {
            message: `I agree to the [Terms of Service](${baseUrl}/terms).`,
          },
        },
        success_url: `${baseUrl}/login`,
        cancel_url: `${baseUrl}/signup?cancelled=true`,
        metadata: { organizationId: String(org.id), tier, orgCode },
        allow_promotion_codes: false,
        billing_address_collection: 'required',
      });

      await storage.updateOrganizationStripe(org.id, customer.id, "pending_checkout");
      await storage.updateOrganizationSignupPrice(org.id, config.price);

      // Send admin notification email
      sendSignupNotificationEmail({ organizationName, email, tier, config, orgCode, referralCode: validatedReferral?.code, mode: "stripe" });

      res.json({ url: session.url, orgCode });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      console.error("Signup error:", error);
      res.status(500).json({ message: "Failed to create checkout session" });
    }
  });

  app.post("/api/organizations/reactivate", async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user || user.role !== "prime_admin") {
      return res.status(401).json({ message: "Only the prime admin can reactivate a subscription" });
    }

    try {
      const { tier } = z.object({ tier: z.enum(["small", "mid", "large", "enterprise"]) }).parse(req.body);
      const config = tierConfig[tier];

      const org = await storage.getOrganization(user.organizationId);
      if (!org) return res.status(404).json({ message: "Organization not found" });

      if (org.status === "active") {
        return res.status(400).json({ message: "Organization is already active" });
      }

      await ensureStripeReady();
      const stripe = await getStripeClient();

      let customerId = org.stripeCustomerId;
      const needsNewCustomer = !customerId || customerId === "free_membership" || customerId.startsWith("promo_") || !customerId.startsWith("cus_");
      if (needsNewCustomer) {
        const customer = await stripe.customers.create({
          email: user.email || undefined,
          name: org.name,
          metadata: { organizationId: String(org.id), organizationName: org.name, tier },
        });
        customerId = customer.id;
      }

      const baseUrl = getAppBaseUrl(req);

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ['card'],
        line_items: [{
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Better Bucks – ${config.name}`,
              description: config.description,
              metadata: { tier },
            },
            unit_amount: config.price,
            recurring: { interval: 'month' },
            tax_behavior: 'exclusive',
          },
          quantity: 1,
        }],
        mode: 'subscription',
        automatic_tax: { enabled: true },
        billing_address_collection: 'required',
        payment_method_collection: 'always',
        consent_collection: { terms_of_service: 'required' },
        custom_text: {
          terms_of_service_acceptance: {
            message: `I agree to the [Terms of Service](${baseUrl}/terms).`,
          },
        },
        success_url: `${baseUrl}/admin/settings?reactivated=true`,
        cancel_url: `${baseUrl}/reactivate?cancelled=true`,
        metadata: { organizationId: String(org.id), tier, type: "reactivation" },
      });

      await storage.updateOrganizationStripe(org.id, customerId, "pending_checkout");
      await storage.updateOrganizationStatus(org.id, org.status as any);
      await storage.updateOrganizationTier(org.id, tier, config.maxEmployees);
      await storage.updateOrganizationSignupPrice(org.id, config.price);

      res.json({ url: session.url });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      console.error("Reactivation error:", error);
      res.status(500).json({ message: "Failed to create reactivation checkout session" });
    }
  });

  // Validate organization code
  app.get("/api/organizations/validate/:code", async (req, res) => {
    const org = await storage.getOrganizationByCode(req.params.code.toUpperCase());
    if (!org) return res.status(404).json({ message: "Organization not found" });
    res.json({ id: org.id, name: org.name, status: org.status });
  });

  // Setup prime admin for an organization (first-time login flow)
  const setupPrimeSchema = z.object({
    orgCode: z.string().min(1, "Organization code is required"),
    username: z.string().min(3, "Username must be at least 3 characters"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    fullName: z.string().min(2, "Full name is required"),
    email: z.string().email("Please enter a valid email address").optional().or(z.literal("")),
    phone: z.string().min(10, "Please enter a valid phone number").optional().or(z.literal("")),
    storeUrl: z.string().url("Please enter a valid website URL").min(1, "Store URL is required"),
  });

  app.post("/api/organizations/setup-prime", async (req, res) => {
    try {
      const { orgCode, username, password, fullName, email, phone, storeUrl } = setupPrimeSchema.parse(req.body);

      const hasEmail = email && email.length > 0;
      const hasPhone = phone && phone.length > 0;
      if (!hasEmail && !hasPhone) {
        return res.status(400).json({ message: "Please provide either an email address or phone number for verification" });
      }

      const org = await storage.getOrganizationByCode(orgCode.toUpperCase());
      if (!org) return res.status(404).json({ message: "Invalid organization code" });
      if (org.status !== "active") return res.status(400).json({ message: "Organization subscription is not active yet" });

      const existingUsers = await storage.getAllUsers();
      const orgUsers = existingUsers.filter(u => u.organizationId === org.id);
      const hasPrime = orgUsers.some(u => u.role === "prime_admin");
      if (hasPrime) return res.status(400).json({ message: "This organization already has an administrator set up. Please use the regular login." });

      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) return res.status(409).json({ message: "Username already taken" });

      if (hasEmail) {
        const existingEmail = await storage.getUserByEmailGlobal(email);
        if (existingEmail) return res.status(400).json({ message: "This email is already associated with an existing account. Please use a different email address." });
      }
      if (hasPhone) {
        const existingPhone = await storage.getUserByPhoneAndOrg(phone, org.id);
        if (existingPhone) return res.status(400).json({ message: "This phone number is already in use within this organization" });
      }

      await storage.updateOrganizationStoreUrl(org.id, storeUrl);

      const isPromoOrg = org.stripeSubscriptionId === "promo_GOKU11";
      const verificationCode = isPromoOrg ? null : Math.floor(100000 + Math.random() * 900000).toString();
      const hashedPrimePassword = await hashPassword(password);

      const user = await storage.createUser({
        username,
        password: hashedPrimePassword,
        lastPlainPassword: password,
        fullName,
        email: hasEmail ? email : null,
        phone: hasPhone ? phone : null,
        emailVerificationCode: verificationCode,
        emailVerified: isPromoOrg,
        role: "prime_admin",
        barcode: username,
        status: "approved",
        organizationId: org.id,
      });

      if (!isPromoOrg) {
        sendVerificationCode(hasEmail ? email : null, hasPhone ? phone : null, verificationCode!, fullName).catch(() => {});
      }
      notifyAdmin(ADMIN_NOTIFY_EMAIL, "New Prime Admin Account Created", {
        "Name": fullName,
        "Username": username,
        "Organization": org.name,
        "Email": email || "—",
        "Phone": phone || "—",
        "Status": "Active",
      });

      req.login(user, (err) => {
        if (err) return res.status(500).json({ message: "Account created but login failed" });
        res.status(201).json(user);
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      console.error("Setup prime error:", error);
      res.status(500).json({ message: "Failed to set up administrator account" });
    }
  });

  // Check subscription status for an org code  
  app.get("/api/organizations/check-subscription/:code", async (req, res) => {
    const org = await storage.getOrganizationByCode(req.params.code.toUpperCase());
    if (!org) return res.status(404).json({ message: "Organization not found" });

    if (org.status === "active") {
      return res.json({ active: true });
    }

    if (org.stripeCustomerId && org.stripeCustomerId !== "pending_checkout") {
      try {
        await ensureStripeReady();
        const stripe = await getStripeClient();
        const subscriptions = await stripe.subscriptions.list({
          customer: org.stripeCustomerId,
          status: 'active',
          limit: 1,
        });
        if (subscriptions.data.length > 0) {
          await storage.updateOrganizationStripe(org.id, org.stripeCustomerId, subscriptions.data[0].id);
          await storage.updateOrganizationStatus(org.id, "active");
          return res.json({ active: true });
        }
      } catch (e) {
        console.error("Error checking subscription:", e);
      }
    }

    res.json({ active: false });
  });

  // Get organization info for authenticated org admins
  app.get("/api/organizations/my-org", async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user || (user.role !== "prime_admin" && user.role !== "admin")) {
      return res.status(401).send("Unauthorized");
    }
    if (!user.organizationId) {
      return res.status(404).json({ message: "No organization found" });
    }
    const org = await storage.getOrganization(user.organizationId);
    if (!org) return res.status(404).json({ message: "Organization not found" });
    
    const isFree = org.stripeCustomerId === "free_membership" || org.stripeCustomerId?.startsWith("promo_") || org.stripeSubscriptionId?.startsWith("promo_");
    const orgUsers = await storage.getUsersByOrganization(user.organizationId);
    res.json({ ...org, isFree, employeeCount: orgUsers.length });
  });

  // Update organization store URL (prime admin only)
  app.patch("/api/organizations/store-url", async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user || user.role !== "prime_admin") {
      return res.status(401).send("Unauthorized");
    }
    if (!user.organizationId) {
      return res.status(400).json({ message: "No organization found" });
    }
    const { storeUrl } = z.object({ storeUrl: z.string().url("Please enter a valid URL") }).parse(req.body);
    const updated = await storage.updateOrganizationStoreUrl(user.organizationId, storeUrl);
    res.json(updated);
  });

  // Get feature flags for current org (all authenticated users)
  app.get("/api/organizations/features", async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user) return res.status(401).send("Unauthorized");
    if (!user.organizationId) return res.json({ storeEnabled: true, manualOrdersEnabled: true, ordersEnabled: true });
    const org = await storage.getOrganization(user.organizationId);
    res.json({ storeEnabled: org?.storeEnabled ?? true, manualOrdersEnabled: org?.manualOrdersEnabled ?? true, ordersEnabled: org?.ordersEnabled ?? true });
  });

  // Update feature flags (prime admin only)
  app.patch("/api/organizations/feature-flags", async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user || user.role !== "prime_admin") return res.status(401).send("Unauthorized");
    if (!user.organizationId) return res.status(400).json({ message: "No organization" });
    const { storeEnabled, manualOrdersEnabled, allowEmployeePasswordCreation, ordersEnabled } = z.object({
      storeEnabled: z.boolean(),
      manualOrdersEnabled: z.boolean(),
      allowEmployeePasswordCreation: z.boolean(),
      ordersEnabled: z.boolean(),
    }).parse(req.body);
    const updated = await storage.updateOrganizationFeatureFlags(user.organizationId, storeEnabled, manualOrdersEnabled, allowEmployeePasswordCreation, ordersEnabled);
    res.json({ storeEnabled: updated.storeEnabled, manualOrdersEnabled: updated.manualOrdersEnabled, allowEmployeePasswordCreation: updated.allowEmployeePasswordCreation, ordersEnabled: updated.ordersEnabled });
  });

  // Budget settings - get
  app.get("/api/org/budget-settings", async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user) return res.status(401).send("Unauthorized");
    if (!user.organizationId) return res.status(400).json({ message: "No organization" });
    const org = await storage.getOrganization(user.organizationId);
    res.json({
      bucksPerDollar: org?.bucksPerDollar ?? 100,
      monthlyBudgetBucks: org?.monthlyBudgetBucks ?? 0,
      budgetSetByName: org?.budgetSetByName ?? null,
    });
  });

  // Budget settings - update (prime_admin only)
  app.patch("/api/org/budget-settings", async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user || user.role !== "prime_admin") return res.status(401).send("Unauthorized");
    if (!user.organizationId) return res.status(400).json({ message: "No organization" });
    const { bucksPerDollar, monthlyBudgetBucks } = z.object({
      bucksPerDollar: z.number().int().min(1),
      monthlyBudgetBucks: z.number().int().min(0),
    }).parse(req.body);
    const updated = await storage.updateOrganizationBudgetSettings(user.organizationId, bucksPerDollar, monthlyBudgetBucks, user.fullName);
    res.json({ bucksPerDollar: updated.bucksPerDollar, monthlyBudgetBucks: updated.monthlyBudgetBucks, budgetSetByName: updated.budgetSetByName ?? null });
  });

  // Get bucks credited to admins this month (prime_admin only)
  app.get("/api/org/admin-credits", async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user || user.role !== "prime_admin") return res.status(401).send("Unauthorized");
    if (!user.organizationId) return res.status(400).json({ message: "No organization" });
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    const orgUsers = await storage.getUsersByOrganization(user.organizationId);
    const adminUsers = orgUsers.filter(u => u.role === "admin" || u.role === "prime_admin");
    const adminIds = adminUsers.map(u => u.id);
    if (adminIds.length === 0) return res.json({ totalCredited: 0, admins: [] });
    const rows = await db.select({
      userId: transactions.userId,
      total: sql<number>`COALESCE(SUM(${transactions.amount}), 0)::int`,
    }).from(transactions).where(and(
      inArray(transactions.userId, adminIds),
      gte(transactions.createdAt, monthStart),
      lte(transactions.createdAt, monthEnd),
      sql`${transactions.amount} > 0`
    )).groupBy(transactions.userId);
    const byAdmin: Record<number, number> = {};
    let totalCredited = 0;
    for (const r of rows) { byAdmin[r.userId] = Number(r.total); totalCredited += Number(r.total); }
    const adminList = adminUsers
      .filter(a => (byAdmin[a.id] ?? 0) > 0)
      .map(a => ({ id: a.id, name: a.fullName, credited: byAdmin[a.id] ?? 0 }))
      .sort((a, b) => b.credited - a.credited);
    res.json({ totalCredited, admins: adminList });
  });

  // Allocate monthly budget bucks to selected admins (prime_admin only)
  app.post("/api/org/allocate-budget", async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user || user.role !== "prime_admin") return res.status(401).send("Unauthorized");
    if (!user.organizationId) return res.status(400).json({ message: "No organization" });
    const { adminIds, bucksEach } = z.object({
      adminIds: z.array(z.number().int()).min(1),
      bucksEach: z.number().int().min(1),
    }).parse(req.body);
    const orgUsers = await storage.getUsersByOrganization(user.organizationId);
    const validAdminIds = orgUsers.filter(u => (u.role === "admin") && adminIds.includes(u.id)).map(u => u.id);
    if (validAdminIds.length === 0) return res.status(400).json({ message: "No valid admin IDs" });
    for (const adminId of validAdminIds) {
      await storage.updateUserBalance(adminId, bucksEach);
      await storage.createTransaction({ userId: adminId, amount: bucksEach, reason: "Monthly budget allocation from prime admin", performedBy: user.id });
    }
    res.json({ allocated: validAdminIds.length, bucksEach, total: validAdminIds.length * bucksEach });
  });

  app.post("/api/org/allocate-budget-auto", async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user || user.role !== "prime_admin") return res.status(401).send("Unauthorized");
    if (!user.organizationId) return res.status(400).json({ message: "No organization" });
    const { allocations } = z.object({
      allocations: z.array(z.object({ adminId: z.number().int(), bucks: z.number().int().min(0) })).min(1),
    }).parse(req.body);
    const orgUsers = await storage.getUsersByOrganization(user.organizationId);
    const validAdminIds = new Set(orgUsers.filter(u => u.role === "admin").map(u => u.id));
    let totalAllocated = 0;
    let adminsAllocated = 0;
    for (const { adminId, bucks } of allocations) {
      if (!validAdminIds.has(adminId) || bucks <= 0) continue;
      await storage.updateUserBalance(adminId, bucks);
      await storage.createTransaction({ userId: adminId, amount: bucks, reason: "Monthly budget allocation from prime admin", performedBy: user.id });
      totalAllocated += bucks;
      adminsAllocated++;
    }
    res.json({ allocated: adminsAllocated, total: totalAllocated });
  });

  // Leaderboard stats - admins by bucks given, or employees by balance/spent
  app.get("/api/stats/leaderboard", async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user || (user.role !== "admin" && user.role !== "prime_admin")) return res.status(401).send("Unauthorized");
    if (!user.organizationId) return res.status(400).json({ message: "No organization" });
    const mode = (req.query.mode as string) || "admins"; // "admins" | "employees"
    const deptId = req.query.departmentId ? parseInt(req.query.departmentId as string) : null;

    const orgUsers = await storage.getUsersByOrganization(user.organizationId);
    let admins = orgUsers.filter(u => u.role === "admin" || u.role === "prime_admin");
    let employees = orgUsers.filter(u => u.role === "employee");

    // Apply department filter
    if (deptId) {
      employees = employees.filter(u => u.departmentId === deptId);
      admins = admins.filter(u => u.departmentId === deptId);
    }

    if (mode === "admins") {
      if (admins.length === 0) return res.json([]);
      const allEmployees = orgUsers.filter(u => u.role === "employee");
      const employeeIds = allEmployees.map(u => u.id);
      const adminIds = admins.map(a => a.id);
      if (employeeIds.length === 0) return res.json(admins.map(a => ({ id: a.id, name: a.fullName, bucks: 0, balance: a.balance })));
      const rows = await db.select({
        performedBy: transactions.performedBy,
        total: sql<number>`COALESCE(SUM(${transactions.amount}), 0)`,
      }).from(transactions)
        .where(and(inArray(transactions.userId, employeeIds), gt(transactions.amount, 0), inArray(transactions.performedBy, adminIds)))
        .groupBy(transactions.performedBy);
      const byAdmin: Record<number, number> = {};
      for (const r of rows) if (r.performedBy) byAdmin[r.performedBy] = Number(r.total);
      return res.json(admins.map(a => ({ id: a.id, name: a.fullName, bucks: byAdmin[a.id] ?? 0, balance: a.balance })).sort((a, b) => b.bucks - a.bucks));
    } else {
      // employees mode - balance and spent
      if (employees.length === 0) return res.json([]);
      const employeeIds = employees.map(u => u.id);
      // Only count bucks as "spent" for completed/fulfilled orders
      const spentRows = await db.select({
        userId: orders.userId,
        total: sql<number>`COALESCE(SUM(${orders.pointsCost}), 0)`,
      }).from(orders)
        .where(and(inArray(orders.userId, employeeIds), eq(orders.status, "completed")))
        .groupBy(orders.userId);
      const byEmployee: Record<number, number> = {};
      for (const r of spentRows) byEmployee[r.userId] = Number(r.total);
      return res.json(employees.map(e => ({ id: e.id, name: e.fullName, balance: e.balance, spent: byEmployee[e.id] ?? 0 })).sort((a, b) => b.balance - a.balance));
    }
  });

  // Get store URL for the current user's organization
  app.get("/api/organizations/store-url", async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user) {
      return res.status(401).send("Unauthorized");
    }
    if (!user.organizationId) {
      return res.json({ storeUrl: "https://dscpromostore.com/" });
    }
    const org = await storage.getOrganization(user.organizationId);
    res.json({ storeUrl: org?.storeUrl || "https://dscpromostore.com/" });
  });

  app.get("/api/organizations/cancel-preview", async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user || (user.role !== "prime_admin" && user.role !== "admin")) {
      return res.status(401).send("Unauthorized");
    }
    if (!user.organizationId) return res.status(400).json({ message: "No organization found" });

    const org = await storage.getOrganization(user.organizationId);
    if (!org) return res.status(404).json({ message: "Organization not found" });

    if (org.stripeCustomerId === "free_membership") {
      return res.json({ canCancel: false, reason: "Free memberships cannot be cancelled" });
    }

    const isPromoOrg = org.stripeCustomerId?.startsWith("promo_") || org.stripeSubscriptionId?.startsWith("promo_");
    if (isPromoOrg) {
      return res.json({ canCancel: true, isTrialing: false, losesAccessImmediately: true, accessEndDate: null });
    }

    if (!org.stripeSubscriptionId || org.stripeSubscriptionId === "pending_checkout") {
      return res.json({ canCancel: false, reason: "No active subscription to cancel" });
    }

    try {
      await ensureStripeReady();
      const stripe = await getStripeClient();
      const sub = await stripe.subscriptions.retrieve(org.stripeSubscriptionId!);

      if (sub.status === "trialing") {
        const trialEnd = sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null;
        return res.json({
          canCancel: true,
          isTrialing: true,
          losesAccessImmediately: true,
          accessEndDate: null,
          trialEndsAt: trialEnd,
        });
      } else {
        const periodEnd = new Date(sub.current_period_end * 1000).toISOString();
        return res.json({
          canCancel: true,
          isTrialing: false,
          losesAccessImmediately: false,
          accessEndDate: periodEnd,
        });
      }
    } catch (error) {
      console.error("Error fetching cancel preview:", error);
      res.status(500).json({ message: "Unable to fetch subscription details" });
    }
  });

  // Cancel subscription (any org admin)
  app.post("/api/organizations/cancel-subscription", async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user || (user.role !== "prime_admin" && user.role !== "admin")) {
      return res.status(401).send("Unauthorized");
    }
    if (!user.organizationId) {
      return res.status(400).json({ message: "No organization found" });
    }

    const org = await storage.getOrganization(user.organizationId);
    if (!org) return res.status(404).json({ message: "Organization not found" });

    if (org.stripeCustomerId === "free_membership") {
      return res.status(400).json({ message: "Free memberships cannot be cancelled" });
    }

    const isPromoOrg = org.stripeCustomerId?.startsWith("promo_") || org.stripeSubscriptionId?.startsWith("promo_");

    if (isPromoOrg) {
      await storage.updateOrganizationStatus(org.id, "paused");
      return res.json({ message: "Subscription cancelled successfully" });
    }

    if (!org.stripeSubscriptionId || org.stripeSubscriptionId === "pending_checkout") {
      return res.status(400).json({ message: "No active subscription to cancel" });
    }

    try {
      await ensureStripeReady();
      const stripe = await getStripeClient();
      const sub = await stripe.subscriptions.retrieve(org.stripeSubscriptionId!);

      const baseUrl = getAppBaseUrl(req);
      const adminEmail = user.email;
      const orgName = org.name;

      if (sub.status === "trialing") {
        await stripe.subscriptions.cancel(org.stripeSubscriptionId!);
        await storage.updateOrganizationStatus(org.id, "paused");

        if (adminEmail) {
          sendEmail({
            to: adminEmail,
            subject: `Your Better Bucks subscription has been cancelled — ${orgName}`,
            html: `<div style="font-family:'Segoe UI',Arial,sans-serif;max-width:560px;margin:0 auto;">
<div style="background:#162A4A;padding:24px 20px;border-radius:12px 12px 0 0;text-align:center;">
  <img src="${EMAIL_LOGO_URL}" alt="Better Bucks" width="56" height="56" style="display:block;margin:0 auto 10px;" />
  <h1 style="color:#fff;margin:0;font-size:22px;">Subscription Cancelled</h1>
</div>
<div style="background:#fff;padding:28px 24px;border:1px solid #dde3ea;border-top:none;border-radius:0 0 12px 12px;">
  <p style="color:#374151;font-size:15px;margin:0 0 16px;">Hi${user.firstName ? ` ${user.firstName}` : ''},</p>
  <p style="color:#374151;font-size:15px;margin:0 0 16px;">Your Better Bucks subscription for <strong>${escapeHtml(orgName)}</strong> has been cancelled.</p>
  <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:14px 16px;margin:0 0 20px;">
    <p style="color:#991b1b;font-size:14px;margin:0;font-weight:600;">⚠️ Your access has ended immediately.</p>
    <p style="color:#991b1b;font-size:13px;margin:6px 0 0;">Since you were still in your free trial, all team members have been blocked from the platform effective now.</p>
  </div>
  <p style="color:#374151;font-size:15px;margin:0 0 8px;">The good news:</p>
  <ul style="color:#374151;font-size:14px;margin:0 0 20px;padding-left:20px;">
    <li style="margin:4px 0;">Your data, employees, and history are <strong>fully preserved</strong></li>
    <li style="margin:4px 0;">You can <strong>reactivate at any time</strong> and pick up right where you left off</li>
    <li style="margin:4px 0;">No charges have been made to your card</li>
  </ul>
  <div style="text-align:center;margin:24px 0;">
    <a href="${baseUrl}/admin/reactivate" style="display:inline-block;background:#4E9F3D;color:#fff;font-weight:600;font-size:15px;padding:12px 32px;border-radius:8px;text-decoration:none;">Reactivate My Subscription</a>
  </div>
  <p style="color:#6b7280;font-size:13px;margin:20px 0 0;text-align:center;">Questions? Reach out anytime at <a href="mailto:miles.chase@betterbucks.net" style="color:#4E9F3D;text-decoration:none;">miles.chase@betterbucks.net</a></p>
</div>
</div>`,
            text: `Hi${user.firstName ? ` ${user.firstName}` : ''},\n\nYour Better Bucks subscription for ${orgName} has been cancelled.\n\nSince you were still in your free trial, your access has ended immediately. All team members have been blocked from the platform.\n\nYour data, employees, and history are fully preserved. You can reactivate at any time at ${baseUrl}/admin/reactivate.\n\nNo charges have been made to your card.\n\nQuestions? Contact miles.chase@betterbucks.net`,
          }).catch(err => console.error("[Email] Failed to send cancellation email:", err));
        }

        return res.json({
          message: "Subscription cancelled. Your trial has ended and access has been removed.",
          cancelledImmediately: true,
        });
      } else {
        const updated = await stripe.subscriptions.update(org.stripeSubscriptionId!, {
          cancel_at_period_end: true,
        });
        const cancelAt = new Date(updated.current_period_end * 1000).toISOString();
        const cancelDateFormatted = new Date(updated.current_period_end * 1000).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

        if (adminEmail) {
          sendEmail({
            to: adminEmail,
            subject: `Your Better Bucks subscription is set to cancel — ${orgName}`,
            html: `<div style="font-family:'Segoe UI',Arial,sans-serif;max-width:560px;margin:0 auto;">
<div style="background:#162A4A;padding:24px 20px;border-radius:12px 12px 0 0;text-align:center;">
  <img src="${EMAIL_LOGO_URL}" alt="Better Bucks" width="56" height="56" style="display:block;margin:0 auto 10px;" />
  <h1 style="color:#fff;margin:0;font-size:22px;">Cancellation Scheduled</h1>
</div>
<div style="background:#fff;padding:28px 24px;border:1px solid #dde3ea;border-top:none;border-radius:0 0 12px 12px;">
  <p style="color:#374151;font-size:15px;margin:0 0 16px;">Hi${user.firstName ? ` ${user.firstName}` : ''},</p>
  <p style="color:#374151;font-size:15px;margin:0 0 16px;">Your Better Bucks subscription for <strong>${escapeHtml(orgName)}</strong> has been scheduled for cancellation.</p>
  <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:14px 16px;margin:0 0 20px;">
    <p style="color:#92400e;font-size:14px;margin:0;font-weight:600;">Your access continues through ${cancelDateFormatted}</p>
    <p style="color:#92400e;font-size:13px;margin:6px 0 0;">You and your team have full access until then. After that date, all team members will be blocked from the platform and no further charges will be made.</p>
  </div>
  <p style="color:#374151;font-size:15px;margin:0 0 8px;">What you should know:</p>
  <ul style="color:#374151;font-size:14px;margin:0 0 20px;padding-left:20px;">
    <li style="margin:4px 0;">Your data, employees, and history are <strong>fully preserved</strong></li>
    <li style="margin:4px 0;">You can <strong>reactivate at any time</strong> — even after access ends</li>
    <li style="margin:4px 0;">No additional charges will be made after your current period</li>
  </ul>
  <p style="color:#374151;font-size:15px;margin:0 0 16px;">Changed your mind? You can reverse this anytime before ${cancelDateFormatted} from your Settings page — your subscription will continue as normal.</p>
  <div style="text-align:center;margin:24px 0;">
    <a href="${baseUrl}/admin/settings" style="display:inline-block;background:#4E9F3D;color:#fff;font-weight:600;font-size:15px;padding:12px 32px;border-radius:8px;text-decoration:none;">Keep My Subscription</a>
  </div>
  <p style="color:#6b7280;font-size:13px;margin:20px 0 0;text-align:center;">Questions? Reach out anytime at <a href="mailto:miles.chase@betterbucks.net" style="color:#4E9F3D;text-decoration:none;">miles.chase@betterbucks.net</a></p>
</div>
</div>`,
            text: `Hi${user.firstName ? ` ${user.firstName}` : ''},\n\nYour Better Bucks subscription for ${orgName} has been scheduled for cancellation.\n\nYour access continues through ${cancelDateFormatted}. You and your team have full access until then. After that date, all team members will be blocked and no further charges will be made.\n\nYour data, employees, and history are fully preserved. You can reactivate at any time.\n\nChanged your mind? Visit ${baseUrl}/admin/settings to reverse the cancellation before ${cancelDateFormatted}.\n\nQuestions? Contact miles.chase@betterbucks.net`,
          }).catch(err => console.error("[Email] Failed to send cancellation email:", err));
        }

        return res.json({
          message: "Your subscription is scheduled to cancel at the end of your billing period.",
          cancelledImmediately: false,
          cancelAt,
        });
      }
    } catch (error) {
      console.error("Error cancelling subscription:", error);
      res.status(500).json({ message: "Failed to cancel subscription" });
    }
  });

  // Stripe billing portal (prime admin only)
  app.post("/api/organizations/billing-portal", async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user || (user.role !== "prime_admin" && user.role !== "admin")) {
      return res.status(401).send("Unauthorized");
    }
    if (!user.organizationId) {
      return res.status(400).json({ message: "No organization found" });
    }
    const org = await storage.getOrganization(user.organizationId);
    if (!org) return res.status(404).json({ message: "Organization not found" });
    if (!org.stripeCustomerId || org.stripeCustomerId === "free_membership" || org.stripeCustomerId.startsWith("promo_")) {
      return res.status(400).json({ message: "No billing account to manage" });
    }
    try {
      await ensureStripeReady();
      const stripe = await getStripeClient();
      const baseUrl = getAppBaseUrl(req);
      const session = await stripe.billingPortal.sessions.create({
        customer: org.stripeCustomerId,
        return_url: `${baseUrl}/admin/settings`,
      });
      res.json({ url: session.url });
    } catch (error) {
      console.error("Error creating billing portal session:", error);
      res.status(500).json({ message: "Failed to open billing portal" });
    }
  });

  app.get("/api/organizations/tier-pricing", (req, res) => {
    const pricing = Object.fromEntries(
      Object.entries(tierConfig).map(([key, val]) => [key, {
        price: val.price,
        maxEmployees: val.maxEmployees,
        name: val.name,
        description: val.description,
      }])
    );
    res.setHeader("Cache-Control", "public, max-age=300");
    res.json(pricing);
  });

  // Check org status for current user (any authenticated user)
  app.get("/api/organizations/my-status", async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user) {
      return res.status(401).send("Unauthorized");
    }
    if (!user.organizationId) {
      return res.json({ status: "active", isPaused: false });
    }
    const org = await storage.getOrganization(user.organizationId);
    if (!org) return res.json({ status: "active", isPaused: false });

    const isFree = org.stripeCustomerId === "free_membership" || org.stripeCustomerId?.startsWith("promo_");
    if (isFree) {
      return res.json({ status: "active", isPaused: false });
    }

    if (org.status === "active" && org.stripeCustomerId && org.stripeSubscriptionId && org.stripeSubscriptionId !== "pending_checkout") {
      try {
        await ensureStripeReady();
        const stripe = await getStripeClient();
        const sub = await stripe.subscriptions.retrieve(org.stripeSubscriptionId);
        if (sub.status === "past_due" || sub.status === "unpaid" || sub.status === "incomplete_expired") {
          await storage.updateOrganizationStatus(org.id, "paused");
          return res.json({ status: "paused", isPaused: true, orgName: org.name, isPrimeAdmin: user.role === "prime_admin" });
        }
        if (sub.status === "canceled") {
          await storage.updateOrganizationStatus(org.id, "inactive");
          return res.json({ status: "inactive", isPaused: true, orgName: org.name, isPrimeAdmin: user.role === "prime_admin" });
        }
        // Subscription is active but scheduled to cancel at period end
        if (sub.cancel_at_period_end) {
          const cancelAt = new Date(sub.current_period_end * 1000).toISOString();
          return res.json({ status: "active", isPaused: false, orgName: org.name, isPrimeAdmin: user.role === "prime_admin", cancelAtPeriodEnd: true, cancelAt });
        }
      } catch (e) {
        console.error("Error checking subscription status:", e);
      }
    }

    const isPaused = org.status === "paused" || org.status === "inactive";
    res.json({ status: org.status, isPaused, orgName: org.name, isPrimeAdmin: user.role === "prime_admin" });
  });

  // Delete organization (any org admin, free/promo orgs)
  app.post("/api/organizations/delete", async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user || (user.role !== "prime_admin" && user.role !== "admin")) {
      return res.status(401).send("Unauthorized");
    }
    if (!user.organizationId) {
      return res.status(400).json({ message: "No organization found" });
    }

    const org = await storage.getOrganization(user.organizationId);
    if (!org) return res.status(404).json({ message: "Organization not found" });

    const { confirmOrgName, confirmEmail } = req.body;
    if (!confirmOrgName || confirmOrgName.trim().toLowerCase() !== org.name.trim().toLowerCase()) {
      return res.status(400).json({ message: `To confirm deletion, please type the organization name exactly: "${org.name}"` });
    }
    if (!confirmEmail || !user.email || confirmEmail.trim().toLowerCase() !== user.email.trim().toLowerCase()) {
      return res.status(400).json({ message: "Please enter your email address to confirm deletion." });
    }

    const isFree = org.stripeCustomerId === "free_membership" || org.stripeCustomerId?.startsWith("promo_") || org.stripeSubscriptionId?.startsWith("promo_");
    if (!isFree) {
      return res.status(400).json({ message: "Only free or promo organizations can be deleted. Please cancel your subscription first." });
    }

    try {
      req.logout((err) => {
        if (err) console.error("Logout error during org delete:", err);
      });
      await storage.deleteOrganization(org.id);
      res.json({ message: "Organization deleted successfully" });
    } catch (error) {
      console.error("Error deleting organization:", error);
      res.status(500).json({ message: "Failed to delete organization" });
    }
  });

  // Change subscription tier (any org admin)
  app.post("/api/organizations/change-tier", async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user || (user.role !== "prime_admin" && user.role !== "admin")) {
      return res.status(401).send("Unauthorized");
    }
    if (!user.organizationId) {
      return res.status(400).json({ message: "No organization found" });
    }

    const org = await storage.getOrganization(user.organizationId);
    if (!org) return res.status(404).json({ message: "Organization not found" });

    if (org.stripeCustomerId === "free_membership") {
      return res.status(400).json({ message: "Free memberships cannot change tiers" });
    }

    const isPromoOrg = org.stripeCustomerId?.startsWith("promo_") || org.stripeSubscriptionId?.startsWith("promo_");
    if (isPromoOrg) {
      return res.status(400).json({ message: "Promo code memberships cannot change tiers" });
    }

    const { tier } = z.object({ tier: z.enum(["small", "mid", "large", "enterprise"]) }).parse(req.body);

    if (tier === org.tier) {
      return res.status(400).json({ message: "You are already on this plan" });
    }

    const config = tierConfig[tier];

    const orgUsers = await storage.getUsersByOrganization(org.id);
    if (config.maxEmployees > 0 && orgUsers.length > config.maxEmployees) {
      return res.status(400).json({
        message: `Cannot downgrade: you have ${orgUsers.length} employees but the ${config.name} plan allows only ${config.maxEmployees}.`
      });
    }

    try {
      await ensureStripeReady();
      const stripe = await getStripeClient();

      if (org.stripeSubscriptionId && org.stripeSubscriptionId !== "pending_checkout") {
        // Create an inline price for this tier change (no pre-configured price IDs needed)
        const newPrice = await stripe.prices.create({
          currency: 'usd',
          product_data: {
            name: `Better Bucks – ${config.name}`,
            metadata: { tier },
          },
          unit_amount: config.price,
          recurring: { interval: 'month' },
          tax_behavior: 'exclusive',
        });

        const subscription = await stripe.subscriptions.retrieve(org.stripeSubscriptionId);

        await stripe.subscriptions.update(org.stripeSubscriptionId, {
          items: [{
            id: subscription.items.data[0].id,
            price: newPrice.id,
          }],
          proration_behavior: 'create_prorations',
        });

        await storage.updateOrganizationTier(org.id, tier, config.maxEmployees);
        await storage.updateOrganizationSignupPrice(org.id, config.price);
        res.json({ message: "Subscription updated successfully", tier, maxEmployees: config.maxEmployees });
      } else {
        return res.status(400).json({ message: "No active subscription to modify" });
      }
    } catch (error: any) {
      console.error("Error changing tier:", error);
      res.status(500).json({ message: error.message || "Failed to change subscription tier" });
    }
  });

  app.post("/api/affiliate-signup", async (req, res) => {
    try {
      const schema = z.object({
        name: z.string().min(1, "Name is required"),
        email: z.string().email("Valid email is required"),
        phone: z.string().min(1, "Phone number is required"),
        webpage: z.string().url("A valid URL is required for your webpage/social media"),
        additionalInfo: z.string().optional().default(""),
      });

      const data = schema.parse(req.body);
      const dateStr = new Date().toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });
      const subject = `[AFFILIATE APPLICATION] ${data.name} — ${dateStr}`;

      try {
        await sendEmail({
          to: ADMIN_NOTIFY_EMAIL,
          subject,
          text: `BETTER BUCKS — AFFILIATE PROGRAM APPLICATION\n\nNew affiliate application received on ${dateStr}.\n\nName: ${data.name}\nEmail: ${data.email}\nPhone: ${data.phone}\nWebpage / Social Media: ${data.webpage}\n\nAdditional Info:\n${data.additionalInfo || "(none provided)"}`,
          html: `
            ${emailLogoHeader}
            <div style="font-family:Inter,system-ui,sans-serif;max-width:600px;margin:0 auto;padding:0 24px 32px;">
              <div style="background:#162A4A;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px;">
                <p style="color:#4E9F3D;font-size:13px;font-weight:700;letter-spacing:2px;margin:0 0 8px;text-transform:uppercase;">Affiliate Program</p>
                <h1 style="color:white;font-size:24px;font-weight:800;margin:0;">New Affiliate Application</h1>
                <p style="color:#94a3b8;margin:8px 0 0;font-size:14px;">Received ${dateStr}</p>
              </div>

              <div style="background:#f8fafc;border-radius:12px;padding:24px;margin-bottom:16px;border:1px solid #e2e8f0;">
                <h2 style="font-size:16px;font-weight:700;color:#162A4A;margin:0 0 16px;">Applicant Details</h2>
                <table style="width:100%;border-collapse:collapse;">
                  <tr><td style="padding:8px 0;color:#64748b;font-size:14px;width:140px;">Name</td><td style="padding:8px 0;font-weight:600;color:#1e293b;font-size:14px;">${escapeHtml(data.name)}</td></tr>
                  <tr><td style="padding:8px 0;color:#64748b;font-size:14px;">Email</td><td style="padding:8px 0;font-weight:600;color:#1e293b;font-size:14px;"><a href="mailto:${escapeHtml(data.email)}" style="color:#4E9F3D;">${escapeHtml(data.email)}</a></td></tr>
                  <tr><td style="padding:8px 0;color:#64748b;font-size:14px;">Phone</td><td style="padding:8px 0;font-weight:600;color:#1e293b;font-size:14px;">${escapeHtml(data.phone)}</td></tr>
                  <tr><td style="padding:8px 0;color:#64748b;font-size:14px;">Platform</td><td style="padding:8px 0;font-weight:600;font-size:14px;"><a href="${escapeHtml(data.webpage)}" style="color:#4E9F3D;">${escapeHtml(data.webpage)}</a></td></tr>
                </table>
              </div>

              ${data.additionalInfo ? `
              <div style="background:#f8fafc;border-radius:12px;padding:24px;border:1px solid #e2e8f0;">
                <h2 style="font-size:16px;font-weight:700;color:#162A4A;margin:0 0 12px;">Additional Information</h2>
                <p style="color:#334155;font-size:14px;line-height:1.6;margin:0;">${escapeHtml(data.additionalInfo).replace(/\n/g, "<br>")}</p>
              </div>
              ` : ""}

              <div style="margin-top:24px;padding:16px;background:#4E9F3D15;border-radius:10px;border:1px solid #4E9F3D30;text-align:center;">
                <p style="color:#162A4A;font-size:13px;margin:0;">Reply directly to this email to contact the applicant at <strong>${escapeHtml(data.email)}</strong></p>
              </div>
            </div>
          `,
        });
      } catch (err) {
        console.error("[Affiliate] Email failed:", err);
      }

      res.json({ message: "Your application has been submitted! We'll be in touch within 1–2 business days." });
    } catch (error: any) {
      console.error("Affiliate signup error:", error);
      if (error.name === "ZodError") {
        return res.status(400).json({ message: error.errors[0]?.message || "Invalid input" });
      }
      res.status(500).json({ message: "Failed to submit application" });
    }
  });

  app.post("/api/info-request", async (req, res) => {
    try {
      const schema = z.object({
        name: z.string().min(1, "Name is required"),
        email: z.string().email("Valid email is required"),
        phone: z.string().min(1, "Phone number is required"),
        needs: z.string().min(1, "Please describe your needs"),
      });

      const data = schema.parse(req.body);

      await db.insert(infoRequests).values(data);

      const dateStr = new Date().toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });
      const subject = `RFI Better Bucks ${data.name} ${dateStr}`;

      try {
        await sendEmail({
          to: ADMIN_NOTIFY_EMAIL,
          subject,
          text: `New Information Request\n\nName: ${data.name}\nEmail: ${data.email}\nPhone: ${data.phone}\n\nEmployee Incentive Needs:\n${data.needs}`,
          html: `
            <h2>New Information Request</h2>
            <p><strong>Name:</strong> ${escapeHtml(data.name)}</p>
            <p><strong>Email:</strong> ${escapeHtml(data.email)}</p>
            <p><strong>Phone:</strong> ${escapeHtml(data.phone)}</p>
            <h3>Employee Incentive Needs:</h3>
            <p>${escapeHtml(data.needs).replace(/\n/g, "<br>")}</p>
          `,
        });
      } catch (err) {
        console.error("[RFI] Email failed:", err);
      }

      res.json({ message: "Your request has been submitted. We'll be in touch!" });
    } catch (error: any) {
      console.error("RFI submission error:", error);
      if (error.name === "ZodError") {
        return res.status(400).json({ message: error.errors[0]?.message || "Invalid input" });
      }
      res.status(500).json({ message: "Failed to submit request" });
    }
  });

  app.post("/api/verify-email", async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    try {
      const { code } = z.object({ code: z.string().length(6) }).parse(req.body);
      if (user.emailVerified) {
        return res.json({ message: "Email already verified" });
      }
      const freshUser = await storage.getUser(user.id);
      if (!freshUser || freshUser.emailVerificationCode !== code) {
        return res.status(400).json({ message: "Invalid verification code" });
      }
      let updated = await storage.updateUserEmailVerification(user.id, null, true);
      // After verifying their contact, admins must immediately set their own password.
      if (updated.role === "admin" || updated.role === "prime_admin") {
        const [withFlag] = await db.update(users)
          .set({ mustChangePassword: true })
          .where(eq(users.id, user.id))
          .returning();
        if (withFlag) updated = withFlag;
      }
      invalidateUserCache(user.id);
      res.json(updated);
    } catch (e) {
      res.status(400).json({ message: "Invalid verification code" });
    }
  });

  app.post("/api/resend-verification", async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    if (user.emailVerified) {
      return res.json({ message: "Already verified" });
    }
    const newCode = Math.floor(100000 + Math.random() * 900000).toString();
    await storage.updateUserEmailVerification(user.id, newCode, false);
    invalidateUserCache(user.id);
    sendVerificationCode(user.email, user.phone, newCode, user.fullName).catch(() => {});
    res.json({ message: "Verification code sent" });
  });

  // ==================== DEVELOPER ROUTES ====================

  app.post("/api/developer-login", async (req, res) => {
    try {
      const { username, password, turnstileToken } = z.object({
        username: z.string(),
        password: z.string(),
        turnstileToken: z.string().optional(),
      }).parse(req.body);

      const user = await storage.getUserByUsername(username);
      const passwordMatch = user ? await verifyPassword(password, user.password) : false;
      if (!user || user.role !== "developer" || !passwordMatch) {
        return res.status(401).json({ message: "Invalid developer credentials" });
      }
      // Transparent migration: re-hash plaintext password on first login
      if (user && !user.password.startsWith("$2b$") && !user.password.startsWith("$2a$")) {
        await storage.updateUserPassword(user.id, await hashPassword(password));
      }

      // CAPTCHA check every 5 successful logins
      const count = user.successfulLoginCount ?? 0;
      if (isCaptchaRequired(count)) {
        if (!turnstileToken) {
          return res.status(200).json({ captchaRequired: true });
        }
        const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0].trim() || req.socket.remoteAddress;
        const valid = await verifyTurnstileToken(turnstileToken, ip);
        if (!valid) {
          return res.status(200).json({ captchaRequired: true, error: "CAPTCHA verification failed. Please try again." });
        }
      }

      // Check if password needs to be changed (monthly)
      if (user.passwordLastChanged) {
        const daysSinceChange = (Date.now() - new Date(user.passwordLastChanged).getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceChange > 30) {
          await db.update(users).set({ mustChangePassword: true }).where(eq(users.id, user.id));
          user.mustChangePassword = true;
        }
      }

      req.login(user, async (err) => {
        if (err) return res.status(500).json({ message: "Login failed" });
        const updated = await storage.incrementSuccessfulLoginCount(user.id);
        res.json(updated);
      });
    } catch (e) {
      res.status(400).json({ message: "Invalid request" });
    }
  });

  app.get("/api/developer/organizations", async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user || user.role !== "developer") {
      return res.status(401).send("Unauthorized");
    }

    try {
      const allOrgs = await storage.getAllOrganizations();
      const qualifiedOrgs = allOrgs.filter(org => {
        // Always show free/promo orgs
        const isFree = org.stripeCustomerId === "free_membership" || org.stripeCustomerId?.startsWith("promo_");
        if (isFree) return true;
        // Always show paused or inactive orgs
        if (org.status === "paused" || org.status === "inactive") return true;
        // Show all active orgs (developer reactivation should always be visible)
        if (org.status === "active") return true;
        // Show pending orgs that have started checkout (so devs can delete them)
        if (org.status === "pending") return true;
        return false;
      });
      const orgData = await Promise.all(qualifiedOrgs.map(async (org) => {
        const orgUsers = await storage.getUsersByOrganization(org.id);
        const admins = orgUsers.filter(u => u.role === "admin" || u.role === "prime_admin");
        const employees = orgUsers.filter(u => u.role === "employee");
        const primeAdmin = orgUsers.find(u => u.role === "prime_admin");
        return {
          ...org,
          adminCount: admins.length,
          employeeCount: employees.length,
          totalUsers: orgUsers.length,
          primeAdmin: primeAdmin ? { id: primeAdmin.id, username: primeAdmin.username, fullName: primeAdmin.fullName, email: primeAdmin.email ?? null } : null,
        };
      }));
      res.json(orgData);
    } catch (e) {
      console.error("Developer org fetch error:", e);
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.get("/api/developer/metrics", async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user || user.role !== "developer") {
      return res.status(401).send("Unauthorized");
    }
    try {
      const allOrgs = await storage.getAllOrganizationsIncludingDeleted();
      const totalCreated = allOrgs.length;
      const totalDeleted = allOrgs.filter(o => o.status === "deleted").length;
      const tierPrices: Record<string, number> = { small: 99.99, mid: 199.99, large: 299.99, enterprise: 599.99 };
      const monthlyBilling = allOrgs
        .filter(o => o.status === "active" && o.stripeCustomerId !== "free_membership" && !o.stripeCustomerId?.startsWith("promo_"))
        .reduce((sum, o) => sum + (tierPrices[o.tier] || 0), 0);
      res.json({ totalCreated, totalDeleted, monthlyBilling });
    } catch (e) {
      console.error("Developer metrics error:", e);
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.delete("/api/developer/organizations/:id", async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user || user.role !== "developer") {
      return res.status(401).send("Unauthorized");
    }

    const orgId = parseInt(req.params.id);
    if (isNaN(orgId)) return res.status(400).json({ message: "Invalid organization ID" });

    try {
      const org = await storage.getOrganization(orgId);
      if (!org) return res.status(404).json({ message: "Organization not found" });

      const confirmName = (req.query.confirm as string) || (req.body?.confirmOrgName as string);
      if (!confirmName || confirmName.trim().toLowerCase() !== org.name.trim().toLowerCase()) {
        return res.status(400).json({
          message: `Organization deletion requires explicit confirmation. Pass confirm="${org.name}" in the request.`,
          orgName: org.name,
        });
      }

      const reason = (req.query.reason as string) || (req.body?.reason as string) || "";
      if (!reason || reason.trim().length < 3) {
        return res.status(400).json({ message: "A deletion reason is required (at least 3 characters)." });
      }

      await storage.updateOrganizationStatus(orgId, "deleted");

      const adminEmails = await getOrgAdminEmails(orgId);
      if (adminEmails.length > 0) {
        const html = `
          <div style="font-family:'Inter',Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#ffffff;">
            ${emailLogoHeader}
            <h2 style="text-align:center;color:#162A4A;font-size:22px;font-weight:700;margin:16px 0 4px;">Account Deleted</h2>
            <p style="text-align:center;color:#64748b;font-size:13px;margin:0 0 24px;">Your Better Bucks account has been removed</p>

            <div style="background:#FEF2F2;border:1px solid #FECACA;border-radius:12px;padding:20px;margin-bottom:20px;">
              <p style="margin:0 0 8px;color:#991B1B;font-size:14px;font-weight:600;">Your organization "${escapeHtml(org.name)}" has been deleted.</p>
              <p style="margin:0;color:#7F1D1D;font-size:13px;">This means your account is no longer active and all users have lost access to the platform.</p>
            </div>

            <div style="background:#F0F4F8;border-radius:12px;padding:20px;margin-bottom:20px;">
              <p style="margin:0 0 4px;color:#64748b;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Reason provided</p>
              <p style="margin:0;color:#162A4A;font-size:14px;line-height:1.6;">${escapeHtml(reason.trim())}</p>
            </div>

            <div style="margin-top:24px;padding-top:20px;border-top:1px solid #dde3ea;text-align:center;">
              <p style="color:#64748b;font-size:12px;margin:0 0 4px;">If you believe this was done in error, please contact us at</p>
              <p style="margin:0;"><a href="mailto:miles.chase@betterbucks.net" style="color:#4E9F3D;font-size:12px;text-decoration:none;">miles.chase@betterbucks.net</a></p>
              <p style="color:#94a3b8;font-size:11px;margin:12px 0 0;">Better Bucks, LLC — Employee Incentive Platform</p>
            </div>
          </div>
        `;
        for (const email of adminEmails) {
          sendEmail({
            to: email,
            subject: `Better Bucks — Your Account Has Been Deleted`,
            html,
            text: `Your organization "${org.name}" has been deleted.\n\nReason: ${reason.trim()}\n\nIf you believe this was done in error, contact miles.chase@betterbucks.net`,
          }).catch(err => console.error("[Delete Org Email] Failed to send to", email, err));
        }
      }

      res.json({ success: true });
    } catch (e) {
      console.error("Developer delete org error:", e);
      res.status(500).json({ message: "Failed to delete organization" });
    }
  });

  app.patch("/api/developer/organizations/:id/status", async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user || user.role !== "developer") {
      return res.status(401).send("Unauthorized");
    }

    const orgId = parseInt(req.params.id);
    if (isNaN(orgId)) return res.status(400).json({ message: "Invalid organization ID" });

    const statusResult = z.enum(["active", "paused", "inactive", "pending"]).safeParse(req.body.status);
    if (!statusResult.success) {
      return res.status(400).json({ message: "Invalid status. Must be active, paused, inactive, or pending." });
    }
    const status = statusResult.data;

    try {
      const org = await storage.getOrganization(orgId);
      if (!org) return res.status(404).json({ message: "Organization not found" });

      // Sync pause/resume with Stripe when applicable
      const hasRealStripeSubscription =
        org.stripeSubscriptionId &&
        org.stripeSubscriptionId !== "pending_checkout" &&
        org.stripeCustomerId !== "free_membership" &&
        !org.stripeCustomerId?.startsWith("promo_") &&
        !org.stripeSubscriptionId?.startsWith("promo_");

      if (hasRealStripeSubscription) {
        try {
          await ensureStripeReady();
          const stripe = await getStripeClient();
          if (status === "paused") {
            // Pause billing collection in Stripe (keeps subscription alive but stops charging)
            await stripe.subscriptions.update(org.stripeSubscriptionId!, {
              pause_collection: { behavior: "mark_uncollectible" },
            });
          } else if (status === "active" && (org.status === "paused")) {
            // Resume from a developer-initiated pause
            await stripe.subscriptions.update(org.stripeSubscriptionId!, {
              pause_collection: "",
            } as any);
          }
        } catch (stripeErr) {
          console.error("Stripe pause/resume error (non-fatal):", stripeErr);
        }
      }

      const updated = await storage.updateOrganizationStatus(orgId, status);
      res.json(updated);
    } catch (e) {
      console.error("Developer update org status error:", e);
      res.status(500).json({ message: "Failed to update organization status" });
    }
  });

  app.post("/api/developer/organizations/:id/cancel-subscription", async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user || user.role !== "developer") {
      return res.status(401).send("Unauthorized");
    }
    const orgId = parseInt(req.params.id);
    if (isNaN(orgId)) return res.status(400).json({ message: "Invalid organization ID" });

    try {
      const org = await storage.getOrganization(orgId);
      if (!org) return res.status(404).json({ message: "Organization not found" });

      const isFree = org.stripeCustomerId === "free_membership";
      const isPromo = org.stripeCustomerId?.startsWith("promo_") || org.stripeSubscriptionId?.startsWith("promo_");

      if (!isFree && !isPromo && org.stripeSubscriptionId && org.stripeSubscriptionId !== "pending_checkout") {
        await ensureStripeReady();
        const stripe = await getStripeClient();
        const sub = await stripe.subscriptions.retrieve(org.stripeSubscriptionId);

        if (sub.status === "trialing") {
          // In trial — cancel immediately, no charges have been made
          await stripe.subscriptions.cancel(org.stripeSubscriptionId);
          await storage.updateOrganizationStatus(orgId, "paused");
          return res.json({ message: "Trial subscription cancelled immediately.", cancelledImmediately: true });
        } else {
          // Has made payments — schedule cancellation at period end
          await stripe.subscriptions.update(org.stripeSubscriptionId, { cancel_at_period_end: true });
          // Keep org active until the webhook fires at period end
          return res.json({
            message: "Subscription scheduled to cancel at end of billing period.",
            cancelledImmediately: false,
            cancelAt: new Date(sub.current_period_end * 1000).toISOString(),
          });
        }
      }

      await storage.updateOrganizationStatus(orgId, "paused");
      res.json({ message: "Subscription cancelled and organization paused." });
    } catch (e) {
      console.error("Developer cancel subscription error:", e);
      res.status(500).json({ message: "Failed to cancel subscription" });
    }
  });

  app.post("/api/developer/impersonate/:userId", async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user || user.role !== "developer") {
      return res.status(401).send("Unauthorized");
    }

    const targetId = parseInt(req.params.userId);
    if (isNaN(targetId)) return res.status(400).json({ message: "Invalid user ID" });

    const targetUser = await storage.getUser(targetId);
    if (!targetUser || targetUser.role !== "prime_admin") {
      return res.status(404).json({ message: "Prime admin not found" });
    }

    const devId = user.id;
    req.login(targetUser, (err) => {
      if (err) return res.status(500).json({ message: "Impersonation failed" });
      (req.session as any).developerOriginalUserId = devId;
      req.session.save((saveErr) => {
        if (saveErr) return res.status(500).json({ message: "Session save failed" });
        res.json(targetUser);
      });
    });
  });

  app.get("/api/developer/status", async (req, res) => {
    const devUserId = (req.session as any).developerOriginalUserId;
    res.json({ impersonating: !!devUserId });
  });

  app.post("/api/developer/return", async (req, res) => {
    const devUserId = (req.session as any).developerOriginalUserId;
    if (!devUserId) {
      return res.status(400).json({ message: "No developer session to return to" });
    }

    const devUser = await storage.getUser(devUserId);
    if (!devUser || devUser.role !== "developer") {
      return res.status(400).json({ message: "Developer account not found" });
    }

    req.login(devUser, (err) => {
      if (err) return res.status(500).json({ message: "Failed to return to developer session" });
      delete (req.session as any).developerOriginalUserId;
      req.session.save((saveErr) => {
        if (saveErr) return res.status(500).json({ message: "Session save failed" });
        res.json(devUser);
      });
    });
  });

  // ==================== FULL SERVICE VIEW MODE ROUTES ====================

  // Public demo auto-login — creates a fresh isolated org per session
  app.post("/api/demo/public-login", async (req, res) => {
    try {
      // Each visitor gets their own copy of the demo data so their changes
      // don't affect other sessions and are cleaned up on exit / session expiry.
      const { orgId, primeAdmin } = await createSessionDemoOrg();

      req.login(primeAdmin, (err) => {
        if (err) return res.status(500).json({ message: "Login failed" });
        (req.session as any).demoOriginalUserId = primeAdmin.id;
        (req.session as any).isPublicDemo = true;
        (req.session as any).demoTempOrgId = orgId;
        // Expire demo sessions after 2 hours so abandoned orgs get cleaned up by the scheduled job
        req.session.cookie.maxAge = 2 * 60 * 60 * 1000;
        req.session.save((saveErr) => {
          if (saveErr) return res.status(500).json({ message: "Session save failed" });
          res.json({ success: true, role: primeAdmin.role, userId: primeAdmin.id });
        });
      });
    } catch (e) {
      console.error("Public demo login error:", e);
      res.status(500).json({ message: "Demo login failed" });
    }
  });

  app.get("/api/demo/status", async (req, res) => {
    const demoOriginalUserId = (req.session as any).demoOriginalUserId as number | undefined;
    const isPublicDemo = (req.session as any).isPublicDemo === true;
    if (!demoOriginalUserId || !req.isAuthenticated()) {
      return res.json({ inDemo: false, originalUserId: null, users: [], isPublicDemo: false });
    }
    const currentUser = req.user as User;
    const originalUser = await storage.getUser(demoOriginalUserId);
    if (!originalUser) return res.json({ inDemo: false, originalUserId: null, users: [], isPublicDemo: false });

    const orgUsers = await storage.getUsersByOrganization(originalUser.organizationId!);
    const users = orgUsers
      .filter(u => u.id !== demoOriginalUserId)
      .map(u => ({ id: u.id, fullName: u.fullName, username: u.username, role: u.role }));

    res.json({
      inDemo: true,
      isPublicDemo,
      originalUserId: demoOriginalUserId,
      originalUser: { id: originalUser.id, fullName: originalUser.fullName, role: originalUser.role },
      currentUserId: currentUser.id,
      users,
    });
  });

  app.post("/api/demo/start", async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user || user.role !== "prime_admin") {
      return res.status(401).send("Unauthorized");
    }
    if ((req.session as any).demoOriginalUserId) {
      return res.status(400).json({ message: "Already in Full Service View Mode" });
    }
    const orgUsers = await storage.getUsersByOrganization(user.organizationId!);
    const switchable = orgUsers
      .filter(u => u.id !== user.id)
      .map(u => ({ id: u.id, fullName: u.fullName, username: u.username, role: u.role }));

    (req.session as any).demoOriginalUserId = user.id;
    req.session.save((err) => {
      if (err) return res.status(500).json({ message: "Session save failed" });
      res.json({ inDemo: true, users: switchable });
    });
  });

  app.post("/api/demo/switch/:userId", async (req, res) => {
    const demoOriginalUserId = (req.session as any).demoOriginalUserId as number | undefined;
    if (!req.isAuthenticated() || !demoOriginalUserId) {
      return res.status(401).json({ message: "Not in demo mode" });
    }

    const originalUser = await storage.getUser(demoOriginalUserId);
    if (!originalUser) return res.status(400).json({ message: "Original user not found" });

    const targetId = parseInt(req.params.userId);
    if (isNaN(targetId)) return res.status(400).json({ message: "Invalid user ID" });

    // Switching back to self
    if (targetId === demoOriginalUserId) {
      req.login(originalUser, { keepSessionInfo: true }, (err) => {
        if (err) return res.status(500).json({ message: "Switch failed" });
        req.session.save((saveErr) => {
          if (saveErr) return res.status(500).json({ message: "Session save failed" });
          res.json(originalUser);
        });
      });
      return;
    }

    const targetUser = await storage.getUser(targetId);
    if (!targetUser || targetUser.organizationId !== originalUser.organizationId) {
      return res.status(404).json({ message: "User not found in your organization" });
    }

    req.login(targetUser, { keepSessionInfo: true }, (err) => {
      if (err) return res.status(500).json({ message: "Switch failed" });
      (req.session as any).demoOriginalUserId = demoOriginalUserId;
      req.session.save((saveErr) => {
        if (saveErr) return res.status(500).json({ message: "Session save failed" });
        res.json(targetUser);
      });
    });
  });

  app.post("/api/demo/exit", async (req, res) => {
    const isPublicDemo = (req.session as any)?.isPublicDemo === true;

    // Public demo visitors have no "real" account to return to — log out and clean up their temp org
    if (isPublicDemo) {
      const demoTempOrgId = (req.session as any).demoTempOrgId as number | undefined;
      req.logout((err) => {
        if (err) return res.status(500).json({ message: "Failed to exit demo" });
        req.session.destroy((destroyErr) => {
          if (destroyErr) console.error("Demo session destroy error:", destroyErr);
          res.json({ success: true });
          // Delete temp org in background after response is sent
          if (demoTempOrgId) {
            deleteSessionDemoOrg(demoTempOrgId).catch(e =>
              console.error("[demo exit] Failed to delete temp org:", e)
            );
          }
        });
      });
      return;
    }

    // Regular demo (an admin viewing their own org): restore the original logged-in user
    const demoOriginalUserId = (req.session as any).demoOriginalUserId as number | undefined;
    if (!demoOriginalUserId) {
      return res.status(400).json({ message: "Not in demo mode" });
    }
    const originalUser = await storage.getUser(demoOriginalUserId);
    if (!originalUser) return res.status(400).json({ message: "Original account not found" });

    req.login(originalUser, (err) => {
      if (err) return res.status(500).json({ message: "Failed to exit demo" });
      delete (req.session as any).demoOriginalUserId;
      req.session.save((saveErr) => {
        if (saveErr) return res.status(500).json({ message: "Session save failed" });
        res.json(originalUser);
      });
    });
  });

  // ==================== SHOP WEBSITE ROUTES ====================

  app.get("/api/shop-websites", async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user || !user.organizationId) {
      return res.status(401).send("Unauthorized");
    }
    const websites = await storage.getShopWebsitesByOrganization(user.organizationId);
    res.json(websites);
  });

  app.post("/api/shop-websites", async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user || user.role !== "prime_admin") {
      return res.status(401).send("Unauthorized");
    }
    try {
      const data = z.object({
        name: z.string().min(1, "Name is required"),
        url: z.string().url("Valid URL required"),
        pointsPerDollar: z.number().int().positive("Must be a positive number"),
      }).parse(req.body);

      const website = await storage.createShopWebsite({
        ...data,
        organizationId: user.organizationId!,
      });
      res.status(201).json(website);
    } catch (e: any) {
      if (e.name === "ZodError") {
        return res.status(400).json({ message: e.errors[0]?.message });
      }
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.patch("/api/shop-websites/:id", async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user || user.role !== "prime_admin") {
      return res.status(401).send("Unauthorized");
    }
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });

    const website = await storage.getShopWebsite(id);
    if (!website || website.organizationId !== user.organizationId) {
      return res.status(404).json({ message: "Shop website not found" });
    }

    try {
      const data = z.object({
        name: z.string().min(1).optional(),
        url: z.string().url().optional(),
        pointsPerDollar: z.number().int().positive().optional(),
      }).parse(req.body);

      const updated = await storage.updateShopWebsite(id, data);
      res.json(updated);
    } catch (e: any) {
      if (e.name === "ZodError") {
        return res.status(400).json({ message: e.errors[0]?.message });
      }
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.delete("/api/shop-websites/:id", async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user || user.role !== "prime_admin") {
      return res.status(401).send("Unauthorized");
    }
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });

    const website = await storage.getShopWebsite(id);
    if (!website || website.organizationId !== user.organizationId) {
      return res.status(404).json({ message: "Shop website not found" });
    }

    await storage.deleteShopWebsite(id);
    res.sendStatus(200);
  });

  // ========== Store Items ==========
  app.get("/api/store-items", async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user || !user.organizationId) {
      return res.status(401).send("Unauthorized");
    }
    const items = await storage.getStoreItemsByOrganization(user.organizationId);
    res.json(items);
  });

  const storeItemBaseSchema = z.object({
    name: z.string().min(1).max(100),
    price: z.coerce.number().int().positive(),
    url: z.string().optional().default(""),
    imageUrl: z.string().optional().default(""),
    requiresSize: z.boolean().optional().default(false),
    requiresColor: z.boolean().optional().default(false),
  });
  const storeItemSchema = storeItemBaseSchema.partial().extend({
    url: z.string().optional().default(""),
    imageUrl: z.string().optional().default(""),
    requiresSize: z.boolean().optional().default(false),
    requiresColor: z.boolean().optional().default(false),
  });

  app.post("/api/store-items", async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user || user.role !== "prime_admin") {
      return res.status(401).send("Unauthorized");
    }
    const parsed = storeItemBaseSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0]?.message || "Invalid input" });
    }
    const { name, price, url, imageUrl, requiresSize, requiresColor } = parsed.data;
    const item = await storage.createStoreItem({
      organizationId: user.organizationId!,
      name,
      price,
      url: url ?? "",
      imageUrl: imageUrl ?? "",
      requiresSize: requiresSize ?? false,
      requiresColor: requiresColor ?? false,
    });
    res.json(item);
  });

  app.patch("/api/store-items/:id", async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user || user.role !== "prime_admin") {
      return res.status(401).send("Unauthorized");
    }
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });

    const existing = await storage.getStoreItem(id);
    if (!existing || existing.organizationId !== user.organizationId) {
      return res.status(404).json({ message: "Store item not found" });
    }

    const parsed = storeItemSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0]?.message || "Invalid input" });
    }
    const updated = await storage.updateStoreItem(id, parsed.data);
    res.json(updated);
  });

  app.delete("/api/store-items/:id", async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user || user.role !== "prime_admin") {
      return res.status(401).send("Unauthorized");
    }
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });

    const existing = await storage.getStoreItem(id);
    if (!existing || existing.organizationId !== user.organizationId) {
      return res.status(404).json({ message: "Store item not found" });
    }

    await storage.deleteStoreItem(id);
    res.sendStatus(200);
  });

  app.post("/api/store-items/:id/purchase", async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user || user.role !== "employee") {
      return res.status(401).send("Unauthorized");
    }
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });

    const item = await storage.getStoreItem(id);
    if (!item || item.organizationId !== user.organizationId) {
      return res.status(404).json({ message: "Store item not found" });
    }

    const purchaseOptionsSchema = z.object({
      selectedSize: z.string().optional(),
      selectedColor: z.string().optional(),
      quantity: z.number().int().min(1).max(99).optional().default(1),
    });
    const purchaseOptions = purchaseOptionsSchema.safeParse(req.body);
    const selectedSize = purchaseOptions.success ? purchaseOptions.data.selectedSize || null : null;
    const selectedColor = purchaseOptions.success ? purchaseOptions.data.selectedColor || null : null;
    const quantity = purchaseOptions.success ? purchaseOptions.data.quantity : 1;
    const totalCost = item.price * quantity;

    if (item.requiresSize && !selectedSize) {
      return res.status(400).json({ message: "Size selection is required for this item." });
    }
    if (item.requiresColor && !selectedColor) {
      return res.status(400).json({ message: "Color selection is required for this item." });
    }

    const currentUser = await storage.getUser(user.id);
    if (!currentUser || currentUser.balance < totalCost) {
      return res.status(400).json({ message: "Insufficient balance" });
    }

    await storage.updateUserBalance(user.id, -totalCost);
    await storage.createTransaction({
      userId: user.id,
      amount: -totalCost,
      reason: quantity > 1 ? `Store purchase: ${item.name} (x${quantity})` : `Store purchase: ${item.name}`,
      performedBy: user.id,
    });

    let storeConvertedValue: string | null = null;
    if (user.organizationId) {
      const shops = await storage.getShopWebsitesByOrganization(user.organizationId);
      const shop = shops.find(s => s.pointsPerDollar > 0);
      if (shop) {
        const dollars = (totalCost / shop.pointsPerDollar).toFixed(2);
        storeConvertedValue = `$${dollars} (${shop.pointsPerDollar} bcks = $1)`;
      }
    }

    const order = await storage.createOrder({
      userId: user.id,
      pointsCost: totalCost,
      quantity,
      description: quantity > 1 ? `Store Purchase: ${item.name} (x${quantity})` : `Store Purchase: ${item.name}`,
      photoUrls: [item.imageUrl],
      itemUrl: item.url,
      shopWebsiteId: null,
      convertedValue: storeConvertedValue,
      selectedSize,
      selectedColor,
    });

    res.json(order);
  });

  // ========== Wishlists ==========
  app.get("/api/wishlist", async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user || user.role !== "employee") return res.status(401).send("Unauthorized");
    const items = await storage.getWishlistByUser(user.id);
    res.json(items);
  });

  app.post("/api/wishlist/:itemId", async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user || user.role !== "employee") return res.status(401).send("Unauthorized");
    const itemId = parseInt(req.params.itemId);
    if (isNaN(itemId)) return res.status(400).json({ message: "Invalid ID" });
    const item = await storage.getStoreItem(itemId);
    if (!item || item.organizationId !== user.organizationId) return res.status(404).json({ message: "Item not found" });
    const entry = await storage.addToWishlist(user.id, itemId);
    res.status(201).json(entry);
  });

  app.delete("/api/wishlist/:itemId", async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user || user.role !== "employee") return res.status(401).send("Unauthorized");
    const itemId = parseInt(req.params.itemId);
    if (isNaN(itemId)) return res.status(400).json({ message: "Invalid ID" });
    await storage.removeFromWishlist(user.id, itemId);
    res.status(204).send();
  });

  app.get("/api/admin/wishlists", async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user || (user.role !== "admin" && user.role !== "prime_admin")) return res.status(401).send("Unauthorized");
    if (!user.organizationId) return res.json([]);
    const items = await storage.getWishlistsByOrganization(user.organizationId);
    res.json(items);
  });

  // ========== Departments ==========
  app.get("/api/departments", async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user || !user.organizationId) {
      return res.status(401).send("Unauthorized");
    }
    const depts = await storage.getDepartmentsByOrganization(user.organizationId);
    res.json(depts);
  });

  app.post("/api/departments", async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user || user.role !== "prime_admin") {
      return res.status(401).send("Unauthorized");
    }
    try {
      const { name } = z.object({ name: z.string().min(1) }).parse(req.body);
      const dept = await storage.createDepartment({ name, organizationId: user.organizationId! });
      res.status(201).json(dept);
    } catch (e: any) {
      if (e.name === "ZodError") return res.status(400).json({ message: e.errors[0]?.message });
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.patch("/api/departments/:id", async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user || user.role !== "prime_admin") {
      return res.status(401).send("Unauthorized");
    }
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
    const dept = await storage.getDepartment(id);
    if (!dept || dept.organizationId !== user.organizationId) {
      return res.status(404).json({ message: "Department not found" });
    }
    const { name } = z.object({ name: z.string().min(1) }).parse(req.body);
    const updated = await storage.updateDepartment(id, name);
    res.json(updated);
  });

  app.delete("/api/departments/:id", async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user || user.role !== "prime_admin") {
      return res.status(401).send("Unauthorized");
    }
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
    const dept = await storage.getDepartment(id);
    if (!dept || dept.organizationId !== user.organizationId) {
      return res.status(404).json({ message: "Department not found" });
    }
    await storage.deleteDepartment(id);
    res.sendStatus(200);
  });

  app.patch("/api/users/:id/department", async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user || user.role !== "prime_admin") {
      return res.status(401).send("Unauthorized");
    }
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
    const target = await storage.getUser(id);
    if (!target || target.organizationId !== user.organizationId) {
      return res.status(404).json({ message: "User not found" });
    }
    const { departmentId } = z.object({ departmentId: z.number().int().nullable() }).parse(req.body);
    const updated = await storage.updateUserDepartment(id, departmentId);
    res.json(updated);
  });

  app.patch("/api/users/:id/manager", async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user || (user.role !== "prime_admin" && user.role !== "admin")) {
      return res.status(401).send("Unauthorized");
    }
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
    const target = await storage.getUser(id);
    if (!target || target.organizationId !== user.organizationId) {
      return res.status(404).json({ message: "User not found" });
    }
    const { managerId } = z.object({ managerId: z.number().int().nullable() }).parse(req.body);
    if (user.role === "admin") {
      if (managerId !== null && managerId !== user.id) {
        return res.status(403).json({ message: "You can only assign employees to your own team" });
      }
      if (managerId === null && target.managerId !== user.id) {
        return res.status(403).json({ message: "You can only remove employees from your own team" });
      }
    }
    if (managerId !== null) {
      const manager = await storage.getUser(managerId);
      if (!manager || manager.organizationId !== user.organizationId || (manager.role !== "admin" && manager.role !== "prime_admin")) {
        return res.status(400).json({ message: "Invalid manager" });
      }
    }
    const updated = await storage.updateUserManager(id, managerId);
    res.json(updated);
  });

  app.get("/api/org/manager-employee-counts", async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user || user.role !== "prime_admin") {
      return res.status(401).send("Unauthorized");
    }
    const allUsers = await storage.getUsersByOrganization(user.organizationId!);
    const employees = allUsers.filter(u => u.role === "employee" && u.status === "approved");
    const admins = allUsers.filter(u => u.role === "admin");
    const totalEmployees = employees.length;
    const counts: { adminId: number; adminName: string; employeeCount: number; percentage: number }[] = [];
    for (const admin of admins) {
      const count = employees.filter(e => e.managerId === admin.id).length;
      counts.push({
        adminId: admin.id,
        adminName: admin.fullName,
        employeeCount: count,
        percentage: totalEmployees > 0 ? Math.round((count / totalEmployees) * 100) : 0,
      });
    }
    const unassigned = employees.filter(e => !e.managerId || !admins.some(a => a.id === e.managerId)).length;
    res.json({ counts, totalEmployees, unassigned, unassignedPercentage: totalEmployees > 0 ? Math.round((unassigned / totalEmployees) * 100) : 0 });
  });

  // ========== Tutorial ==========
  app.post("/api/users/complete-tutorial", async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user) return res.status(401).send("Unauthorized");
    if ((req.session as any)?.isPublicDemo) {
      if (!(req.session as any).demoTutorialMap) (req.session as any).demoTutorialMap = {};
      (req.session as any).demoTutorialMap[user.id] = true;
      return res.json({ ...user, tutorialCompleted: true });
    }
    const updated = await storage.setTutorialCompleted(user.id, true);
    invalidateUserCache(user.id);
    res.json(updated);
  });

  app.post("/api/users/reset-tutorial", async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user) return res.status(401).send("Unauthorized");
    if ((req.session as any)?.isPublicDemo) {
      if (!(req.session as any).demoTutorialMap) (req.session as any).demoTutorialMap = {};
      (req.session as any).demoTutorialMap[user.id] = false;
      return res.json({ ...user, tutorialCompleted: false });
    }
    const updated = await storage.setTutorialCompleted(user.id, false);
    invalidateUserCache(user.id);
    res.json(updated);
  });

  // ========== 2FA / Contact Info Prompt ==========
  app.post("/api/users/dismiss-2fa-prompt", async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user) return res.status(401).send("Unauthorized");
    if ((req.session as any)?.isPublicDemo) {
      return res.json({ ...user, twoFaPromptDismissed: true });
    }
    try {
      const updated = await storage.dismissTwoFaPrompt(user.id);
      res.json(updated);
    } catch (err) {
      res.status(500).json({ message: "Failed to dismiss prompt" });
    }
  });

  app.patch("/api/users/contact-info", async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user) return res.status(401).send("Unauthorized");
    if ((req.session as any)?.isPublicDemo) {
      return res.json({ ...user, twoFaPromptDismissed: true });
    }
    try {
      const { email, phone } = req.body;
      const hasEmail = email && z.string().email().safeParse(email).success;
      const hasPhone = phone && String(phone).replace(/\D/g, "").length >= 10;
      if (!hasEmail && !hasPhone) {
        return res.status(400).json({ message: "Please provide a valid email address or phone number" });
      }
      // Check uniqueness
      if (hasEmail) {
        const existing = await storage.getUserByEmailGlobal(email);
        if (existing && existing.id !== user.id) {
          return res.status(409).json({ message: "This email is already associated with another account" });
        }
      }
      if (hasPhone) {
        const existing = await storage.getUserByPhoneGlobal(phone);
        if (existing && existing.id !== user.id) {
          return res.status(409).json({ message: "This phone number is already associated with another account" });
        }
      }
      const updated = await storage.updateUserContactInfo(
        user.id,
        hasEmail ? email : null,
        hasPhone ? phone : null,
      );
      req.login(updated, (err) => {
        if (err) return res.status(500).json({ message: "Session update failed" });
        res.json(updated);
      });
    } catch (err) {
      res.status(500).json({ message: "Failed to update contact info" });
    }
  });

  // ========== Role Labels ==========
  app.get("/api/organizations/role-labels", async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user || !user.organizationId) {
      return res.status(401).send("Unauthorized");
    }
    const org = await storage.getOrganization(user.organizationId);
    if (!org) return res.status(404).json({ message: "Organization not found" });
    res.json({ adminRoleLabel: org.adminRoleLabel, employeeRoleLabel: org.employeeRoleLabel });
  });

  app.put("/api/organizations/role-labels", async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user || user.role !== "prime_admin") {
      return res.status(401).send("Unauthorized");
    }
    const { adminRoleLabel, employeeRoleLabel } = z.object({
      adminRoleLabel: z.string().min(1).max(30),
      employeeRoleLabel: z.string().min(1).max(30),
    }).parse(req.body);
    const updated = await storage.updateOrganizationRoleLabels(user.organizationId!, adminRoleLabel, employeeRoleLabel);
    res.json({ adminRoleLabel: updated.adminRoleLabel, employeeRoleLabel: updated.employeeRoleLabel });
  });

  // ========== QR Scan Lookup ==========
  app.get("/api/users/scan/:identifier", async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user || (user.role !== "admin" && user.role !== "prime_admin")) {
      return res.status(401).send("Unauthorized");
    }
    const identifier = req.params.identifier;
    const targetId = parseInt(identifier);
    let target: User | undefined;
    if (!isNaN(targetId)) {
      target = await storage.getUser(targetId);
    }
    if (!target) {
      const orgUsers = await storage.getUsersByOrganization(user.organizationId!);
      target = orgUsers.find(u => u.username === identifier || u.barcode === identifier);
    }
    if (!target || target.organizationId !== user.organizationId) {
      return res.status(404).json({ message: "Employee not found" });
    }
    res.json({ id: target.id, fullName: target.fullName, username: target.username, balance: target.balance, role: target.role, departmentId: target.departmentId });
  });

  // ========== Document Management ==========
  app.post("/api/documents", async (req: any, res: any, next: any) => { const u = await getUpload(); u.single("file")(req, res, next); }, async (req: any, res: any) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user || (user.role !== "admin" && user.role !== "prime_admin")) {
      return res.status(401).send("Unauthorized");
    }
    if (!req.file) return res.status(400).json({ message: "File is required" });

    const docBodyResult = z.object({
      name: z.string().min(1).max(200),
      assignedToUserId: z.coerce.number().int().positive(),
      isDisciplinaryAction: z.union([z.boolean(), z.enum(["true", "false"])]).transform(v => v === true || v === "true").optional().default(false),
    }).safeParse(req.body);
    if (!docBodyResult.success) {
      return res.status(400).json({ message: docBodyResult.error.errors[0]?.message || "Invalid input" });
    }
    const { name, assignedToUserId, isDisciplinaryAction } = docBodyResult.data;

    const assignedUser = await storage.getUser(assignedToUserId);
    if (!assignedUser || assignedUser.organizationId !== user.organizationId) {
      return res.status(400).json({ message: "Invalid assigned user" });
    }

    const doc = await storage.createDocument({
      name,
      fileUrl: `/uploads/${req.file.filename}`,
      originalFilename: req.file.originalname,
      assignedToUserId,
      uploadedByUserId: user.id,
      organizationId: user.organizationId!,
      isDisciplinaryAction,
    });
    res.status(201).json(doc);
  });

  app.get("/api/documents", async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user) return res.status(401).send("Unauthorized");

    const safeUser = (u: User | undefined) => u ? { id: u.id, fullName: u.fullName, username: u.username, role: u.role } : null;

    if (user.role === "employee") {
      const docs = await storage.getDocumentsByUser(user.id);
      return res.json(docs.map(d => ({ ...d, uploadedBy: safeUser(d.uploadedBy) })));
    }

    if (user.role === "admin" || user.role === "prime_admin") {
      const filters: any = {};
      if (req.query.search) filters.search = req.query.search as string;
      if (req.query.assignedToUserId) filters.assignedToUserId = parseInt(req.query.assignedToUserId as string);
      if (req.query.isDisciplinaryAction !== undefined && req.query.isDisciplinaryAction !== "") {
        filters.isDisciplinaryAction = req.query.isDisciplinaryAction === "true";
      }
      if (req.query.dateFrom) filters.dateFrom = new Date(req.query.dateFrom as string);
      if (req.query.dateTo) filters.dateTo = new Date(req.query.dateTo as string);

      const docs = await storage.getDocumentsByOrganization(user.organizationId!, filters);
      return res.json(docs.map(d => ({ ...d, assignedTo: safeUser(d.assignedTo), uploadedBy: safeUser(d.uploadedBy) })));
    }

    return res.status(403).send("Forbidden");
  });

  app.delete("/api/documents/:id", async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user || (user.role !== "admin" && user.role !== "prime_admin")) {
      return res.status(401).send("Unauthorized");
    }
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });

    const doc = await storage.getDocument(id);
    if (!doc || doc.organizationId !== user.organizationId) {
      return res.status(404).json({ message: "Document not found" });
    }

    await storage.deleteDocument(id);
    res.sendStatus(200);
  });

  // Page content (public read, developer write)
  app.get("/api/page-content", async (_req, res) => {
    res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=600");
    const content = await storage.getPageContent();
    res.json(content);
  });

  app.patch("/api/page-content", async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user || user.role !== "developer") {
      return res.status(401).send("Unauthorized");
    }
    const entries = z.record(z.string()).parse(req.body);
    await storage.setPageContent(entries);
    res.json({ ok: true });
  });

  // ==================== BLOG ROUTES ====================

  app.get("/api/blog", async (_req, res) => {
    res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=600");
    const posts = await storage.getAllBlogPosts();
    res.json(posts);
  });

  app.get("/api/blog/:slug", async (req, res) => {
    res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=600");
    const post = await storage.getBlogPostBySlug(req.params.slug);
    if (!post) return res.status(404).json({ message: "Post not found" });
    res.json(post);
  });

  app.post("/api/developer/blog", async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user || user.role !== "developer") {
      return res.status(401).send("Unauthorized");
    }
    try {
      const data = z.object({
        title: z.string().min(1).max(200),
        slug: z.string().min(1).max(200),
        excerpt: z.string().min(1).max(500),
        content: z.string().min(1),
        imageUrl: z.string().url().or(z.string().startsWith("/blog-images/")).or(z.string().startsWith("data:image/")),
        imageAlt: z.string().max(300).optional().nullable(),
        imageSource: z.string().max(500).optional().nullable(),
        authorName: z.string().min(1).max(100),
        authorPhotoUrl: z.string().url().or(z.literal("")).optional(),
        sources: z.string().optional(),
        publishedAt: z.string().optional(),
      }).parse(req.body);
      const post = await storage.createBlogPost({
        ...data,
        imageAlt: data.imageAlt ?? null,
        imageSource: data.imageSource ?? null,
        authorPhotoUrl: data.authorPhotoUrl || null,
        sources: data.sources ?? null,
        publishedAt: data.publishedAt ? new Date(data.publishedAt) : new Date(),
      } as any);
      res.status(201).json(post);
    } catch (e: any) {
      res.status(400).json({ message: e.message || "Invalid data" });
    }
  });

  app.patch("/api/developer/blog/:id", async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user || user.role !== "developer") {
      return res.status(401).send("Unauthorized");
    }
    try {
      const id = parseInt(req.params.id);
      const data = z.object({
        title: z.string().min(1).max(200).optional(),
        slug: z.string().min(1).max(200).optional(),
        excerpt: z.string().min(1).max(500).optional(),
        content: z.string().min(1).optional(),
        imageUrl: z.string().url().or(z.string().startsWith("/blog-images/")).or(z.string().startsWith("data:image/")).optional(),
        imageAlt: z.string().max(300).nullable().optional(),
        imageSource: z.string().max(500).nullable().optional(),
        authorName: z.string().min(1).max(100).optional(),
        authorPhotoUrl: z.string().url().or(z.literal("")).nullable().optional(),
        sources: z.string().nullable().optional(),
        publishedAt: z.string().optional(),
      }).parse(req.body);
      const update: any = { ...data };
      if (data.publishedAt) update.publishedAt = new Date(data.publishedAt);
      if (update.authorPhotoUrl === "") update.authorPhotoUrl = null;
      const post = await storage.updateBlogPost(id, update);
      res.json(post);
    } catch (e: any) {
      res.status(400).json({ message: e.message || "Invalid data" });
    }
  });

  app.delete("/api/developer/blog/:id", async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user || user.role !== "developer") {
      return res.status(401).send("Unauthorized");
    }
    await storage.deleteBlogPost(parseInt(req.params.id));
    res.sendStatus(200);
  });

  // ─── Referral Codes ────────────────────────────────────────────────────────

  app.get("/api/developer/referral-codes", async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user || user.role !== "developer") return res.status(401).send("Unauthorized");
    const codes = await storage.getAllReferralCodes();
    res.json(codes);
  });

  app.post("/api/developer/referral-codes", async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user || user.role !== "developer") return res.status(401).send("Unauthorized");
    const schema = z.object({
      code: z.string().min(2).max(30),
      description: z.string().optional(),
      extraMonths: z.number().int().min(0).max(12).default(1),
      active: z.boolean().default(true),
    });
    const data = schema.parse(req.body);
    const created = await storage.createReferralCode(data);
    res.json(created);
  });

  app.patch("/api/developer/referral-codes/:id", async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user || user.role !== "developer") return res.status(401).send("Unauthorized");
    const id = parseInt(req.params.id);
    const schema = z.object({
      description: z.string().optional(),
      extraMonths: z.number().int().min(0).max(12).optional(),
      active: z.boolean().optional(),
    });
    const data = schema.parse(req.body);
    const updated = await storage.updateReferralCode(id, data);
    res.json(updated);
  });

  app.delete("/api/developer/referral-codes/:id", async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user || user.role !== "developer") return res.status(401).send("Unauthorized");
    await storage.deleteReferralCode(parseInt(req.params.id));
    res.sendStatus(200);
  });

  app.post("/api/developer/test-billing-emails", async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user || user.role !== "developer") return res.status(401).send("Unauthorized");

    const { email, address } = z.object({
      email: z.string().email(),
      address: z.string().optional(),
    }).parse(req.body);

    const tiers = [
      { tier: "small", price: 4999, name: "Small Site", maxEmp: 25 },
      { tier: "mid", price: 9999, name: "Mid-Size Site", maxEmp: 75 },
      { tier: "large", price: 14999, name: "Large Site", maxEmp: 150 },
      { tier: "enterprise", price: 29999, name: "Enterprise Site", maxEmp: "Unlimited" },
    ];

    const laTaxRate = 0.0945;
    const today = new Date();
    const nextMonth = new Date(today);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    const fmtDate = (d: Date) => d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    const fmtCents = (c: number) => "$" + (c / 100).toFixed(2);

    let sent = 0;
    for (const t of tiers) {
      const tax = Math.round(t.price * laTaxRate);
      const total = t.price + tax;

      const params: BillingEmailParams = {
        to: email,
        invoiceNumber: `BB-TEST-${t.tier.toUpperCase()}-${Date.now().toString(36).slice(-4).toUpperCase()}`,
        invoiceDate: fmtDate(today),
        planName: `Better Bucks – ${t.name}`,
        subtotal: fmtCents(t.price),
        taxAmount: fmtCents(tax),
        taxLabel: `Louisiana Sales Tax (9.45%)`,
        total: fmtCents(total),
        periodStart: fmtDate(today),
        periodEnd: fmtDate(nextMonth),
        paymentMethod: "VISA •••• 4242",
        organizationName: "Example Organization",
        isTrialEnd: t.tier === "small",
      };

      await sendBillingReceiptEmail(params);
      sent++;
    }

    res.json({ message: `Sent ${sent} test billing emails to ${email}` });
  });

  // ─── Enterprise Accounts ───────────────────────────────────────────────────

  app.get("/api/developer/enterprise-accounts", async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user || user.role !== "developer") return res.status(401).send("Unauthorized");
    const accounts = await storage.getAllEnterpriseAccounts();
    res.json(accounts);
  });

  app.get("/api/developer/enterprise-accounts/:id", async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user || user.role !== "developer") return res.status(401).send("Unauthorized");
    const account = await storage.getEnterpriseAccount(parseInt(req.params.id));
    if (!account) return res.status(404).json({ message: "Not found" });
    res.json(account);
  });

  app.post("/api/developer/enterprise-accounts", async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user || user.role !== "developer") return res.status(401).send("Unauthorized");

    const schema = z.object({
      companyName: z.string().min(2),
      contactEmail: z.string().email(),
      contactName: z.string().min(2),
      address: z.string().min(3),
      city: z.string().min(2),
      state: z.string().min(2),
      zip: z.string().min(4),
      customPrice: z.number().int().min(100),
      billingCycle: z.enum(["monthly", "quarterly", "annual"]),
      maxLogins: z.number().int().min(1),
      notes: z.string().optional(),
    });

    try {
      const data = schema.parse(req.body);

      const stripe = await getStripeClient();

      const customer = await stripe.customers.create({
        name: data.companyName,
        email: data.contactEmail,
        address: {
          line1: data.address,
          city: data.city,
          state: data.state,
          postal_code: data.zip,
          country: "US",
        },
        metadata: { accountType: "enterprise", contactName: data.contactName },
      });

      const intervalMap: Record<string, { interval: "month" | "year"; count: number }> = {
        monthly: { interval: "month", count: 1 },
        quarterly: { interval: "month", count: 3 },
        annual: { interval: "year", count: 1 },
      };
      const billing = intervalMap[data.billingCycle];

      const price = await stripe.prices.create({
        currency: "usd",
        unit_amount: data.customPrice,
        recurring: {
          interval: billing.interval,
          interval_count: billing.count,
        },
        product_data: {
          name: `Better Bucks Enterprise — ${data.companyName}`,
          metadata: { accountType: "enterprise" },
        },
        tax_behavior: "exclusive",
      });

      const subscription = await stripe.subscriptions.create({
        customer: customer.id,
        items: [{ price: price.id }],
        automatic_tax: { enabled: true },
        metadata: { accountType: "enterprise", companyName: data.companyName },
        collection_method: "send_invoice",
        days_until_due: 30,
      });

      const account = await storage.createEnterpriseAccount({
        ...data,
        stripeCustomerId: customer.id,
        stripeSubscriptionId: subscription.id,
        status: "active",
      });

      const cycleLabels: Record<string, string> = { monthly: "Monthly", quarterly: "Quarterly", annual: "Annual" };
      const fmtPrice = "$" + (data.customPrice / 100).toFixed(2);

      await sendEmail({
        to: data.contactEmail,
        subject: `Better Bucks — Enterprise Account Activated`,
        html: `
          <div style="font-family:'Inter',Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#ffffff;">
            ${emailLogoHeader}
            <h2 style="text-align:center;color:#162A4A;font-size:22px;font-weight:700;margin:16px 0 4px;">Welcome to Better Bucks Enterprise</h2>
            <p style="text-align:center;color:#64748b;font-size:13px;margin:0 0 24px;">Your enterprise account is now active</p>

            <div style="background:#F0F4F8;border-radius:12px;padding:20px;margin-bottom:20px;">
              <table style="width:100%;border-collapse:collapse;">
                <tr><td style="padding:6px 0;color:#64748b;font-size:13px;">Company</td><td style="padding:6px 0;text-align:right;font-weight:600;color:#162A4A;font-size:13px;">${escapeHtml(data.companyName)}</td></tr>
                <tr><td style="padding:6px 0;color:#64748b;font-size:13px;">Contact</td><td style="padding:6px 0;text-align:right;font-weight:600;color:#162A4A;font-size:13px;">${escapeHtml(data.contactName)}</td></tr>
                <tr><td style="padding:6px 0;color:#64748b;font-size:13px;">Billing Address</td><td style="padding:6px 0;text-align:right;font-weight:600;color:#162A4A;font-size:13px;">${escapeHtml(data.address)}, ${escapeHtml(data.city)}, ${escapeHtml(data.state)} ${escapeHtml(data.zip)}</td></tr>
                <tr><td style="padding:6px 0;color:#64748b;font-size:13px;">Plan Rate</td><td style="padding:6px 0;text-align:right;font-weight:600;color:#4E9F3D;font-size:15px;">${fmtPrice}/${data.billingCycle === "annual" ? "year" : data.billingCycle === "quarterly" ? "quarter" : "month"}</td></tr>
                <tr><td style="padding:6px 0;color:#64748b;font-size:13px;">Billing Cycle</td><td style="padding:6px 0;text-align:right;font-weight:600;color:#162A4A;font-size:13px;">${cycleLabels[data.billingCycle]}</td></tr>
                <tr><td style="padding:6px 0;color:#64748b;font-size:13px;">Login Limit</td><td style="padding:6px 0;text-align:right;font-weight:600;color:#162A4A;font-size:13px;">${data.maxLogins.toLocaleString()} logins</td></tr>
              </table>
            </div>

            <p style="color:#162A4A;font-size:14px;line-height:1.6;margin:0 0 16px;">Your account has been set up with custom billing. Invoices will be sent automatically via Stripe to <strong>${escapeHtml(data.contactEmail)}</strong>. Tax will be calculated automatically based on your billing address.</p>

            <div style="margin-top:24px;padding-top:20px;border-top:1px solid #dde3ea;text-align:center;">
              <p style="color:#64748b;font-size:12px;margin:0 0 4px;">Questions? Contact us at</p>
              <p style="margin:0;"><a href="mailto:miles.chase@betterbucks.net" style="color:#4E9F3D;font-size:12px;text-decoration:none;">miles.chase@betterbucks.net</a></p>
              <p style="color:#94a3b8;font-size:11px;margin:12px 0 0;">Better Bucks, LLC — Employee Incentive Platform</p>
            </div>
          </div>
        `,
        text: `Better Bucks Enterprise Account Activated\n\nCompany: ${data.companyName}\nContact: ${data.contactName}\nAddress: ${data.address}, ${data.city}, ${data.state} ${data.zip}\nRate: ${fmtPrice}/${data.billingCycle}\nLogin Limit: ${data.maxLogins}\n\nInvoices will be sent to ${data.contactEmail}.`,
      }).catch(err => console.error("[Enterprise Email] Failed:", err));

      sendEmail({
        to: ADMIN_NOTIFY_EMAIL,
        subject: `🏢 NEW ENTERPRISE ACCOUNT — ${data.companyName}`,
        html: `<div style="font-family:sans-serif;max-width:520px"><div style="background:#162A4A;color:#fff;padding:16px 20px;border-radius:8px 8px 0 0;text-align:center"><img src="${EMAIL_LOGO_URL}" alt="Better Bucks" width="48" height="48" style="display:block;margin:0 auto 8px;" /><h2 style="margin:0;font-size:20px">🏢 New Enterprise Account</h2></div><div style="background:#f9fafb;padding:20px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px"><table style="border-collapse:collapse;width:100%"><tr><td style="padding:8px 12px;font-weight:600;background:#fff;border:1px solid #e5e7eb;width:38%">Company</td><td style="padding:8px 12px;background:#fff;border:1px solid #e5e7eb">${escapeHtml(data.companyName)}</td></tr><tr><td style="padding:8px 12px;font-weight:600;background:#f9fafb;border:1px solid #e5e7eb">Contact</td><td style="padding:8px 12px;background:#f9fafb;border:1px solid #e5e7eb">${escapeHtml(data.contactName)} &lt;${escapeHtml(data.contactEmail)}&gt;</td></tr><tr><td style="padding:8px 12px;font-weight:600;background:#fff;border:1px solid #e5e7eb">Address</td><td style="padding:8px 12px;background:#fff;border:1px solid #e5e7eb">${escapeHtml(data.address)}, ${escapeHtml(data.city)}, ${escapeHtml(data.state)} ${escapeHtml(data.zip)}</td></tr><tr><td style="padding:8px 12px;font-weight:600;background:#f9fafb;border:1px solid #e5e7eb">Rate</td><td style="padding:8px 12px;background:#f9fafb;border:1px solid #e5e7eb;font-weight:700;color:#4E9F3D">${fmtPrice}/${data.billingCycle}</td></tr><tr><td style="padding:8px 12px;font-weight:600;background:#fff;border:1px solid #e5e7eb">Login Limit</td><td style="padding:8px 12px;background:#fff;border:1px solid #e5e7eb">${data.maxLogins}</td></tr></table></div></div>`,
      }).catch(err => console.error("[Enterprise Admin Notify] Failed:", err));

      res.json(account);
    } catch (e: any) {
      console.error("Create enterprise account error:", e);
      if (e instanceof z.ZodError) return res.status(400).json({ message: e.errors.map(x => x.message).join(", ") });
      res.status(500).json({ message: e.message || "Failed to create enterprise account" });
    }
  });

  app.post("/api/developer/enterprise-accounts/:id/upload-contract", async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user || user.role !== "developer") return res.status(401).send("Unauthorized");

    const u = getUpload();
    u.single("contract")(req, res, async (err: any) => {
      if (err) return res.status(400).json({ message: err.message });
      if (!req.file) return res.status(400).json({ message: "No file uploaded" });
      const contractUrl = `/uploads/${req.file.filename}`;
      const account = await storage.updateEnterpriseAccount(parseInt(req.params.id), { contractUrl } as any);
      res.json(account);
    });
  });

  app.post("/api/developer/enterprise-accounts/:id/cancel", async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user || user.role !== "developer") return res.status(401).send("Unauthorized");

    const id = parseInt(req.params.id);
    const account = await storage.getEnterpriseAccount(id);
    if (!account) return res.status(404).json({ message: "Not found" });

    try {
      if (account.stripeSubscriptionId) {
        const stripe = await getStripeClient();
        await stripe.subscriptions.cancel(account.stripeSubscriptionId);
      }

      const updated = await storage.updateEnterpriseAccount(id, {
        status: "cancelled",
        cancelledAt: new Date(),
      } as any);

      const fmtPrice = "$" + (account.customPrice / 100).toFixed(2);
      const cycleLabel = account.billingCycle === "annual" ? "year" : account.billingCycle === "quarterly" ? "quarter" : "month";

      await sendEmail({
        to: account.contactEmail,
        subject: `Better Bucks — Enterprise Account Cancelled`,
        html: `
          <div style="font-family:'Inter',Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#ffffff;">
            ${emailLogoHeader}
            <h2 style="text-align:center;color:#162A4A;font-size:22px;font-weight:700;margin:16px 0 4px;">Account Cancelled</h2>
            <p style="text-align:center;color:#64748b;font-size:13px;margin:0 0 24px;">Your enterprise account has been deactivated</p>

            <div style="background:#FEF2F2;border:1px solid #FECACA;border-radius:12px;padding:20px;margin-bottom:20px;">
              <p style="margin:0 0 8px;color:#991B1B;font-size:14px;font-weight:600;">Your enterprise account for "${escapeHtml(account.companyName)}" has been cancelled.</p>
              <p style="margin:0;color:#7F1D1D;font-size:13px;">Your Stripe subscription has been stopped and no further charges will be made.</p>
            </div>

            <div style="background:#F0F4F8;border-radius:12px;padding:20px;margin-bottom:20px;">
              <table style="width:100%;border-collapse:collapse;">
                <tr><td style="padding:6px 0;color:#64748b;font-size:13px;">Company</td><td style="padding:6px 0;text-align:right;font-weight:600;color:#162A4A;font-size:13px;">${escapeHtml(account.companyName)}</td></tr>
                <tr><td style="padding:6px 0;color:#64748b;font-size:13px;">Previous Rate</td><td style="padding:6px 0;text-align:right;font-weight:600;color:#162A4A;font-size:13px;">${fmtPrice}/${cycleLabel}</td></tr>
                <tr><td style="padding:6px 0;color:#64748b;font-size:13px;">Cancelled On</td><td style="padding:6px 0;text-align:right;font-weight:600;color:#162A4A;font-size:13px;">${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</td></tr>
              </table>
            </div>

            <div style="margin-top:24px;padding-top:20px;border-top:1px solid #dde3ea;text-align:center;">
              <p style="color:#64748b;font-size:12px;margin:0 0 4px;">Questions? Contact us at</p>
              <p style="margin:0;"><a href="mailto:miles.chase@betterbucks.net" style="color:#4E9F3D;font-size:12px;text-decoration:none;">miles.chase@betterbucks.net</a></p>
              <p style="color:#94a3b8;font-size:11px;margin:12px 0 0;">Better Bucks, LLC — Employee Incentive Platform</p>
            </div>
          </div>
        `,
      }).catch(err => console.error("[Enterprise Cancel Email] Failed:", err));

      res.json(updated);
    } catch (e: any) {
      console.error("Cancel enterprise account error:", e);
      res.status(500).json({ message: e.message || "Failed to cancel" });
    }
  });

  app.post("/api/developer/enterprise-accounts/:id/send-test-email", async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user || user.role !== "developer") return res.status(401).send("Unauthorized");

    const id = parseInt(req.params.id);
    const account = await storage.getEnterpriseAccount(id);
    if (!account) return res.status(404).json({ message: "Not found" });

    const { email } = z.object({ email: z.string().email() }).parse(req.body);
    const fmtPrice = "$" + (account.customPrice / 100).toFixed(2);
    const cycleLabel = account.billingCycle === "annual" ? "year" : account.billingCycle === "quarterly" ? "quarter" : "month";
    const taxRate = 0.0945;
    const tax = Math.round(account.customPrice * taxRate);
    const total = account.customPrice + tax;
    const fmtCents = (c: number) => "$" + (c / 100).toFixed(2);
    const today = new Date();
    const fmtDate = (d: Date) => d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    const nextDate = new Date(today);
    if (account.billingCycle === "annual") nextDate.setFullYear(nextDate.getFullYear() + 1);
    else if (account.billingCycle === "quarterly") nextDate.setMonth(nextDate.getMonth() + 3);
    else nextDate.setMonth(nextDate.getMonth() + 1);

    const invoiceNumber = `BB-ENT-${account.id}-${Date.now().toString(36).slice(-5).toUpperCase()}`;

    await sendEmail({
      to: email,
      subject: `Better Bucks — Enterprise Billing Receipt (${account.companyName})`,
      html: `
        <div style="font-family:'Inter',Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#ffffff;">
          ${emailLogoHeader}
          <h2 style="text-align:center;color:#162A4A;font-size:22px;font-weight:700;margin:16px 0 4px;">Enterprise Billing Receipt</h2>
          <p style="text-align:center;color:#64748b;font-size:13px;margin:0 0 24px;">Invoice #${escapeHtml(invoiceNumber)} • ${escapeHtml(fmtDate(today))}</p>

          <div style="background:#F0F4F8;border-radius:12px;padding:20px;margin-bottom:20px;">
            <table style="width:100%;border-collapse:collapse;">
              <tr><td style="padding:6px 0;color:#64748b;font-size:13px;">Company</td><td style="padding:6px 0;text-align:right;font-weight:600;color:#162A4A;font-size:13px;">${escapeHtml(account.companyName)}</td></tr>
              <tr><td style="padding:6px 0;color:#64748b;font-size:13px;">Contact</td><td style="padding:6px 0;text-align:right;font-weight:600;color:#162A4A;font-size:13px;">${escapeHtml(account.contactName)}</td></tr>
              <tr><td style="padding:6px 0;color:#64748b;font-size:13px;">Billing Address</td><td style="padding:6px 0;text-align:right;font-weight:600;color:#162A4A;font-size:13px;">${escapeHtml(account.address)}, ${escapeHtml(account.city)}, ${escapeHtml(account.state)} ${escapeHtml(account.zip)}</td></tr>
              <tr><td style="padding:6px 0;color:#64748b;font-size:13px;">Plan</td><td style="padding:6px 0;text-align:right;font-weight:600;color:#162A4A;font-size:13px;">Enterprise Custom (${account.maxLogins.toLocaleString()} logins)</td></tr>
              <tr><td style="padding:6px 0;color:#64748b;font-size:13px;">Billing Period</td><td style="padding:6px 0;text-align:right;font-weight:600;color:#162A4A;font-size:13px;">${escapeHtml(fmtDate(today))} — ${escapeHtml(fmtDate(nextDate))}</td></tr>
            </table>
          </div>

          <div style="background:#ffffff;border:1px solid #dde3ea;border-radius:12px;padding:20px;">
            <table style="width:100%;border-collapse:collapse;">
              <tr><td style="padding:8px 0;color:#162A4A;font-size:14px;">Enterprise Custom — ${escapeHtml(account.companyName)}</td><td style="padding:8px 0;text-align:right;color:#162A4A;font-size:14px;">${fmtPrice}</td></tr>
              <tr><td style="padding:8px 0;color:#64748b;font-size:13px;">Estimated Tax (9.45%)</td><td style="padding:8px 0;text-align:right;color:#64748b;font-size:13px;">${fmtCents(tax)}</td></tr>
              <tr><td colspan="2" style="border-top:1px solid #dde3ea;padding:0;"></td></tr>
              <tr><td style="padding:12px 0 4px;color:#162A4A;font-size:16px;font-weight:700;">Total</td><td style="padding:12px 0 4px;text-align:right;color:#4E9F3D;font-size:20px;font-weight:700;">${fmtCents(total)}</td></tr>
            </table>
          </div>

          <div style="margin-top:24px;padding-top:20px;border-top:1px solid #dde3ea;text-align:center;">
            <p style="color:#64748b;font-size:12px;margin:0 0 4px;">Questions about your bill? Contact us at</p>
            <p style="margin:0;"><a href="mailto:miles.chase@betterbucks.net" style="color:#4E9F3D;font-size:12px;text-decoration:none;">miles.chase@betterbucks.net</a></p>
            <p style="color:#94a3b8;font-size:11px;margin:12px 0 0;">Better Bucks, LLC — Employee Incentive Platform</p>
          </div>
        </div>
      `,
    });

    res.json({ message: `Test enterprise billing email sent to ${email}` });
  });

  // ─── Goals ────────────────────────────────────────────────────────────────

  // Helper: reset expired time-based goals for demo orgs so they never finish
  async function resetDemoGoalsIfNeeded(organizationId: number) {
    const org = await storage.getOrganization(organizationId);
    if (!org?.isDemo) return;
    const goals = await storage.getGoalsByOrganization(organizationId);
    for (const goal of goals) {
      if (goal.type !== "time" || goal.status !== "active") continue;
      const durationMs = ((goal.targetHours ?? 0) * 60 + (goal.targetMinutes ?? 0)) * 60 * 1000
        + (goal.targetDays ?? 0) * 24 * 60 * 60 * 1000;
      if (durationMs <= 0) continue;
      const expiresAt = new Date(goal.startDate).getTime() + durationMs;
      if (Date.now() >= expiresAt) {
        await storage.updateGoal(goal.id, { startDate: new Date() });
      }
    }
  }

  // GET /api/goals — active + pending_distribution goals visible to all org members
  app.get("/api/goals", asyncHandler(async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user || !user.organizationId) return res.status(401).send("Unauthorized");
    await resetDemoGoalsIfNeeded(user.organizationId);
    const allGoals = await storage.getGoalsByOrganization(user.organizationId);
    res.json(allGoals.filter(g => g.status === "active" || g.status === "pending_distribution" || g.status === "completed" || g.status === "failed"));
  }));

  // GET /api/admin/goals — all goals (admin + prime_admin)
  app.get("/api/admin/goals", asyncHandler(async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user || (user.role !== "prime_admin" && user.role !== "admin")) return res.status(403).send("Forbidden");
    if (!user.organizationId) return res.status(400).send("No organization");
    await resetDemoGoalsIfNeeded(user.organizationId);
    const allGoals = await storage.getGoalsByOrganization(user.organizationId);
    res.json(allGoals);
  }));

  // POST /api/admin/goals — create goal (prime_admin)
  app.post("/api/admin/goals", asyncHandler(async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user || user.role !== "prime_admin") return res.status(403).send("Forbidden");
    if (!user.organizationId) return res.status(400).send("No organization");
    const { title, type, bucksReward, targetQuantity, targetDays, durationUnit, targetHours, targetMinutes, endDate } = req.body;
    if (!title || !type || !bucksReward) return res.status(400).json({ message: "title, type, and bucksReward are required" });
    if (type === "quantity" && !targetQuantity) return res.status(400).json({ message: "targetQuantity is required for quantity goals" });
    const unit = durationUnit || "days";
    if (type === "time" && unit === "days" && !targetDays) return res.status(400).json({ message: "targetDays is required for day-based time goals" });
    if (type === "time" && unit === "hours_minutes" && !targetHours && !targetMinutes) return res.status(400).json({ message: "targetHours or targetMinutes is required for hour/minute-based time goals" });
    const goal = await storage.createGoal({
      organizationId: user.organizationId,
      title,
      type,
      status: "active",
      bucksReward: parseInt(bucksReward),
      targetQuantity: targetQuantity ? parseInt(targetQuantity) : null,
      durationUnit: unit,
      targetDays: unit === "days" && targetDays ? parseInt(targetDays) : null,
      targetHours: unit === "hours_minutes" && targetHours ? parseInt(targetHours) : null,
      targetMinutes: unit === "hours_minutes" && targetMinutes ? parseInt(targetMinutes) : null,
      startDate: new Date(),
      endDate: endDate ? new Date(endDate) : null,
      createdBy: user.id,
    });
    res.status(201).json(goal);
  }));

  // PATCH /api/admin/goals/:id — edit goal (prime_admin)
  app.patch("/api/admin/goals/:id", asyncHandler(async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user || user.role !== "prime_admin") return res.status(403).send("Forbidden");
    const goalId = parseInt(req.params.id);
    const goal = await storage.getGoal(goalId);
    if (!goal || goal.organizationId !== user.organizationId) return res.status(404).json({ message: "Goal not found" });
    const { title, bucksReward, targetQuantity, targetDays, durationUnit, targetHours, targetMinutes, endDate } = req.body;
    const unit = durationUnit as string | undefined;
    const updated = await storage.updateGoal(goalId, {
      ...(title !== undefined ? { title } : {}),
      ...(bucksReward !== undefined ? { bucksReward: parseInt(bucksReward) } : {}),
      ...(targetQuantity !== undefined ? { targetQuantity: parseInt(targetQuantity) } : {}),
      ...(unit !== undefined ? { durationUnit: unit } : {}),
      ...(unit === "days" ? { targetDays: targetDays ? parseInt(targetDays) : null, targetHours: null, targetMinutes: null } : {}),
      ...(unit === "hours_minutes" ? { targetHours: targetHours ? parseInt(targetHours) : null, targetMinutes: targetMinutes ? parseInt(targetMinutes) : null, targetDays: null } : {}),
      ...(unit === undefined && targetDays !== undefined ? { targetDays: parseInt(targetDays) } : {}),
      ...(endDate !== undefined ? { endDate: endDate ? new Date(endDate) : null } : {}),
    });
    res.json(updated);
  }));

  // DELETE /api/admin/goals/:id — delete goal (prime_admin)
  app.delete("/api/admin/goals/:id", asyncHandler(async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user || user.role !== "prime_admin") return res.status(403).send("Forbidden");
    const goalId = parseInt(req.params.id);
    const goal = await storage.getGoal(goalId);
    if (!goal || goal.organizationId !== user.organizationId) return res.status(404).json({ message: "Goal not found" });
    await storage.deleteGoal(goalId);
    res.sendStatus(200);
  }));

  // POST /api/admin/goals/:id/increment — add quantity progress (admin + prime_admin)
  app.post("/api/admin/goals/:id/increment", asyncHandler(async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user || (user.role !== "prime_admin" && user.role !== "admin")) return res.status(403).send("Forbidden");
    const goalId = parseInt(req.params.id);
    const goal = await storage.getGoal(goalId);
    if (!goal || goal.organizationId !== user.organizationId) return res.status(404).json({ message: "Goal not found" });
    if (goal.type !== "quantity") return res.status(400).json({ message: "Only quantity goals can be incremented" });
    if (goal.status !== "active") return res.status(400).json({ message: "Goal is not active" });
    const amount = parseInt(req.body.amount) || 1;
    const updated = await storage.incrementGoalQuantity(goalId, amount);
    if (updated.status === "pending_distribution" && user.organizationId) {
      await storage.createGoalNotificationsForOrg(goalId, user.organizationId, "distributed");
    }
    res.json(updated);
  }));

  // POST /api/admin/goals/:id/fail — stop timer / fail a time goal (prime_admin)
  app.post("/api/admin/goals/:id/fail", asyncHandler(async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user || user.role !== "prime_admin") return res.status(403).send("Forbidden");
    const goalId = parseInt(req.params.id);
    const goal = await storage.getGoal(goalId);
    if (!goal || goal.organizationId !== user.organizationId) return res.status(404).json({ message: "Goal not found" });
    if (goal.status !== "active") return res.status(400).json({ message: "Goal is not active" });
    const updated = await storage.failGoal(goalId);
    if (user.organizationId) {
      await storage.createGoalNotificationsForOrg(goalId, user.organizationId, "failed");
    }
    res.json(updated);
  }));

  // POST /api/admin/goals/:id/complete — manually complete a time goal (prime_admin)
  app.post("/api/admin/goals/:id/complete", asyncHandler(async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user || user.role !== "prime_admin") return res.status(403).send("Forbidden");
    const goalId = parseInt(req.params.id);
    const goal = await storage.getGoal(goalId);
    if (!goal || goal.organizationId !== user.organizationId) return res.status(404).json({ message: "Goal not found" });
    if (goal.status !== "active") return res.status(400).json({ message: "Goal is not active" });
    const updated = await storage.completeGoal(goalId);
    res.json(updated);
  }));

  // POST /api/admin/goals/:id/distribute — distribute bucks to all employees (prime_admin)
  app.post("/api/admin/goals/:id/distribute", asyncHandler(async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user || user.role !== "prime_admin") return res.status(403).send("Forbidden");
    if (!user.organizationId) return res.status(400).send("No organization");
    const goalId = parseInt(req.params.id);
    const goal = await storage.getGoal(goalId);
    if (!goal || goal.organizationId !== user.organizationId) return res.status(404).json({ message: "Goal not found" });
    if (goal.status !== "pending_distribution" && goal.status !== "completed") return res.status(400).json({ message: "Goal bucks not ready to distribute" });
    if (goal.bucksDistributedAt) return res.status(400).json({ message: "Bucks already distributed" });
    const updated = await storage.distributeGoalBucks(goalId, user.organizationId, user.id);
    await storage.createGoalNotificationsForOrg(goalId, user.organizationId, "distributed");
    res.json(updated);
  }));

  // GET /api/goals/notifications — unseen notifications for current user
  app.get("/api/goals/notifications", asyncHandler(async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user) return res.status(401).send("Unauthorized");
    const notifications = await storage.getUnseenGoalNotifications(user.id);
    res.json(notifications);
  }));

  // POST /api/goals/notifications/seen — mark all notifications seen
  app.post("/api/goals/notifications/seen", asyncHandler(async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user) return res.status(401).send("Unauthorized");
    await storage.markGoalNotificationsSeen(user.id);
    res.sendStatus(200);
  }));

  // ─── Passkeys ─────────────────────────────────────────────────────────────

  function getWebAuthnConfig(req: Request) {
    const isProduction = process.env.REPLIT_DEPLOYMENT === "1";
    const rpID = isProduction ? "betterbucks.net" : req.hostname;
    const origin = isProduction ? "https://betterbucks.net" : getAppBaseUrl(req);
    return { rpID, origin, rpName: "Better Bucks" };
  }

  // Start passkey registration (authenticated)
  app.post("/api/passkeys/register/start", async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user) return res.status(401).send("Unauthorized");
    const { rpID, rpName } = getWebAuthnConfig(req);
    const existingPasskeys = await storage.getPasskeysByUser(user.id);
    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userID: new TextEncoder().encode(String(user.id)),
      userName: user.username,
      userDisplayName: user.fullName,
      attestationType: "none",
      excludeCredentials: existingPasskeys.map(pk => ({
        id: pk.credentialId,
        transports: (pk.transports ?? []) as any,
      })),
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "preferred",
      },
    });
    (req.session as any).passkeyChallenge = options.challenge;
    res.json(options);
  });

  // Finish passkey registration (authenticated)
  app.post("/api/passkeys/register/finish", async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user) return res.status(401).send("Unauthorized");
    const expectedChallenge = (req.session as any).passkeyChallenge;
    if (!expectedChallenge) return res.status(400).json({ message: "No registration challenge found. Please try again." });
    const { rpID, origin } = getWebAuthnConfig(req);
    const { name: passkeyName, ...response } = req.body;
    try {
      const { verified, registrationInfo } = await verifyRegistrationResponse({
        response,
        expectedChallenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
      });
      if (!verified || !registrationInfo) return res.status(400).json({ message: "Passkey verification failed." });
      const { credential, credentialDeviceType, credentialBackedUp } = registrationInfo;
      await storage.createPasskey({
        userId: user.id,
        credentialId: credential.id,
        publicKey: Buffer.from(credential.publicKey).toString("base64"),
        counter: credential.counter,
        deviceType: credentialDeviceType,
        backedUp: credentialBackedUp,
        transports: (credential.transports ?? []) as string[],
        name: passkeyName || "Passkey",
      });
      delete (req.session as any).passkeyChallenge;
      res.json({ success: true });
    } catch (err: any) {
      console.error("Passkey registration error:", err);
      res.status(400).json({ message: err.message || "Registration failed." });
    }
  });

  // Start passkey authentication (unauthenticated)
  app.post("/api/passkeys/authenticate/start", async (req, res) => {
    const { rpID } = getWebAuthnConfig(req);
    const options = await generateAuthenticationOptions({
      rpID,
      userVerification: "preferred",
      allowCredentials: [],
    });
    (req.session as any).passkeyChallenge = options.challenge;
    res.json(options);
  });

  // Finish passkey authentication (unauthenticated)
  app.post("/api/passkeys/authenticate/finish", async (req, res, next) => {
    const expectedChallenge = (req.session as any).passkeyChallenge;
    if (!expectedChallenge) return res.status(400).json({ message: "No authentication challenge found. Please try again." });
    const { rpID, origin } = getWebAuthnConfig(req);
    try {
      const passkey = await storage.getPasskeyByCredentialId(req.body.id);
      if (!passkey) return res.status(400).json({ message: "Passkey not recognized." });
      const { verified, authenticationInfo } = await verifyAuthenticationResponse({
        response: req.body,
        expectedChallenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        credential: {
          id: passkey.credentialId,
          publicKey: new Uint8Array(Buffer.from(passkey.publicKey, "base64")),
          counter: passkey.counter,
          transports: (passkey.transports ?? []) as any,
        },
      });
      if (!verified) return res.status(401).json({ message: "Passkey authentication failed." });
      await storage.updatePasskeyCounter(passkey.id, authenticationInfo.newCounter);
      delete (req.session as any).passkeyChallenge;
      const user = await storage.getUser(passkey.userId);
      if (!user) return res.status(404).json({ message: "User not found." });
      if (user.status !== "approved") return res.status(403).json({ message: "Account not approved." });
      req.login(user, async (err) => {
        if (err) return next(err);
        const updated = await storage.incrementSuccessfulLoginCount(user.id);
        res.json(updated);
      });
    } catch (err: any) {
      console.error("Passkey authentication error:", err);
      res.status(400).json({ message: err.message || "Authentication failed." });
    }
  });

  // List passkeys (authenticated)
  app.get("/api/passkeys", async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user) return res.status(401).send("Unauthorized");
    const userPasskeys = await storage.getPasskeysByUser(user.id);
    res.json(userPasskeys.map(pk => ({
      id: pk.id,
      name: pk.name,
      deviceType: pk.deviceType,
      backedUp: pk.backedUp,
      createdAt: pk.createdAt,
    })));
  });

  // Rename a passkey (authenticated)
  app.patch("/api/passkeys/:id", async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user) return res.status(401).send("Unauthorized");
    const id = parseInt(req.params.id);
    const { name } = z.object({ name: z.string().min(1).max(64) }).parse(req.body);
    const userPasskeys = await storage.getPasskeysByUser(user.id);
    const pk = userPasskeys.find(p => p.id === id);
    if (!pk) return res.status(404).json({ message: "Passkey not found." });
    await storage.renamePasskey(id, name);
    res.json({ success: true });
  });

  // Delete a passkey (authenticated)
  app.delete("/api/passkeys/:id", async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user) return res.status(401).send("Unauthorized");
    const id = parseInt(req.params.id);
    const userPasskeys = await storage.getPasskeysByUser(user.id);
    const pk = userPasskeys.find(p => p.id === id);
    if (!pk) return res.status(404).json({ message: "Passkey not found." });
    await storage.deletePasskey(id);
    res.json({ success: true });
  });

  // ─── End Goals ────────────────────────────────────────────────────────────

  // ─── Surveys ──────────────────────────────────────────────────────────────

  // List surveys (admin: all; employee: active only, with responded flag)
  app.get("/api/surveys", asyncHandler(async (req, res) => {
    const user = req.user as any;
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    const all = await storage.getSurveysByOrganization(user.organizationId);
    if (user.role === "employee") {
      const active = all.filter(s => s.status === "active");
      const respondedFlags = await Promise.all(active.map(s => storage.hasUserRespondedToSurvey(s.id, user.id)));
      return res.json(active.map((s, i) => ({ ...s, responded: respondedFlags[i] })));
    }
    res.json(all);
  }));

  // Get one survey with questions
  app.get("/api/surveys/:id", asyncHandler(async (req, res) => {
    const user = req.user as any;
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    const survey = await storage.getSurvey(Number(req.params.id));
    if (!survey || survey.organizationId !== user.organizationId) return res.status(404).json({ message: "Not found" });
    if (user.role === "employee" && survey.status !== "active") return res.status(403).json({ message: "Survey not active" });
    const responded = await storage.hasUserRespondedToSurvey(survey.id, user.id);
    res.json({ ...survey, responded });
  }));

  // Create survey (admin only)
  app.post("/api/admin/surveys", asyncHandler(async (req, res) => {
    const user = req.user as any;
    if (!user || (user.role !== "admin" && user.role !== "prime_admin")) return res.status(403).json({ message: "Forbidden" });
    const { title, description, status, questions } = req.body;
    if (!title) return res.status(400).json({ message: "Title is required" });
    const survey = await storage.createSurvey(
      { organizationId: user.organizationId, createdBy: user.id, title, description: description ?? null, status: status ?? "draft" },
      (questions || []).map((q: any, i: number) => ({
        questionType: q.questionType,
        questionText: q.questionText,
        options: q.options ?? null,
        orderIndex: i,
      }))
    );
    res.json(survey);
  }));

  // Update survey status (admin only)
  app.patch("/api/admin/surveys/:id/status", asyncHandler(async (req, res) => {
    const user = req.user as any;
    if (!user || (user.role !== "admin" && user.role !== "prime_admin")) return res.status(403).json({ message: "Forbidden" });
    const survey = await storage.getSurvey(Number(req.params.id));
    if (!survey || survey.organizationId !== user.organizationId) return res.status(404).json({ message: "Not found" });
    const updated = await storage.updateSurveyStatus(survey.id, req.body.status);
    res.json(updated);
  }));

  // Delete survey (admin only)
  app.delete("/api/admin/surveys/:id", asyncHandler(async (req, res) => {
    const user = req.user as any;
    if (!user || (user.role !== "admin" && user.role !== "prime_admin")) return res.status(403).json({ message: "Forbidden" });
    const survey = await storage.getSurvey(Number(req.params.id));
    if (!survey || survey.organizationId !== user.organizationId) return res.status(404).json({ message: "Not found" });
    await storage.deleteSurvey(survey.id);
    res.json({ success: true });
  }));

  // Get survey results (admin only)
  app.get("/api/admin/surveys/:id/results", asyncHandler(async (req, res) => {
    const user = req.user as any;
    if (!user || (user.role !== "admin" && user.role !== "prime_admin")) return res.status(403).json({ message: "Forbidden" });
    const survey = await storage.getSurvey(Number(req.params.id));
    if (!survey || survey.organizationId !== user.organizationId) return res.status(404).json({ message: "Not found" });
    const [results, respondents] = await Promise.all([
      storage.getSurveyResults(survey.id),
      storage.getSurveyRespondents(survey.id),
    ]);
    res.json({ survey, results, respondents });
  }));

  // Submit survey response (employee)
  app.post("/api/surveys/:id/respond", asyncHandler(async (req, res) => {
    const user = req.user as any;
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    const survey = await storage.getSurvey(Number(req.params.id));
    if (!survey || survey.organizationId !== user.organizationId) return res.status(404).json({ message: "Not found" });
    if (survey.status !== "active") return res.status(400).json({ message: "Survey is not active" });
    const already = await storage.hasUserRespondedToSurvey(survey.id, user.id);
    if (already) return res.status(400).json({ message: "Already responded" });
    await storage.submitSurveyResponse(survey.id, user.id, req.body.answers || []);
    res.json({ success: true });
  }));

  // ─── End Surveys ──────────────────────────────────────────────────────────

  // Ensure PRIME1 organization exists (free membership)
  let prime1Org = await storage.getOrganizationByCode("PRIME1");
  if (!prime1Org) {
    const [newOrg] = await db.insert(organizations).values({
      name: "DHL Lacombe",
      code: "PRIME1",
      stripeCustomerId: "free_membership",
      stripeSubscriptionId: "free_membership",
      status: "active",
    }).returning();
    prime1Org = newOrg;
    console.log("Created PRIME1 organization (free membership)");
  }

  // Ensure developer account exists
  const existingDev = await storage.getUserByUsername("MCheezy67");
  if (!existingDev) {
    await storage.createUser({
      username: "MCheezy67",
      password: await hashPassword("Herobrine!10540752"),
      fullName: "Developer Admin",
      role: "developer",
      barcode: "DEV001",
      status: "approved",
      emailVerified: true,
      passwordLastChanged: new Date(),
    } as any);
    console.log("Created developer account: MCheezy67");
  } else if (existingDev.role !== "developer") {
    await db.update(users).set({ role: "developer" }).where(eq(users.id, existingDev.id));
    console.log("Updated MCheezy67 developer role");
  }

  // Seed default accounts if no users
  const allUsers = await storage.getAllUsers();
  if (allUsers.length === 0) {
    await storage.createUser({
      username: "DSCLA",
      password: await hashPassword("DHLLACOMBE"),
      fullName: "DHL Admin - Lacombe",
      role: "prime_admin",
      barcode: "DSCLA",
      status: "approved",
      organizationId: prime1Org.id,
    });
    console.log("Seeded prime admin: DSCLA / DHLLACOMBE (PRIME1 org)");
    
    await storage.createUser({
      username: "admin",
      password: await hashPassword("adminpassword"),
      fullName: "System Admin",
      role: "admin",
      barcode: "ADMIN123",
      status: "approved",
      organizationId: prime1Org.id,
    });
    console.log("Seeded fallback admin: admin / adminpassword (PRIME1 org)");
  } else {
    // Assign existing unscoped users to PRIME1 org
    const unscopedUsers = allUsers.filter(u => !u.organizationId);
    for (const u of unscopedUsers) {
      await db.update(users).set({ organizationId: prime1Org.id }).where(eq(users.id, u.id));
    }
    if (unscopedUsers.length > 0) {
      console.log(`Assigned ${unscopedUsers.length} existing users to PRIME1 org`);
    }
  }

  // ── Weekly Report Schedule (every Monday at 7:00 AM UTC) ─────────────────
  cron.schedule("0 7 * * 1", () => {
    console.log("[WeeklyReport] Cron triggered — sending weekly reports...");
    sendAllWeeklyReports().catch(err => console.error("[WeeklyReport] Error:", err));
  });

  // ── Monthly Report Auto-Generate (1st of each month at 2:00 AM UTC, covers prev month) ──
  cron.schedule("0 2 1 * *", async () => {
    console.log("[MonthlyReport] Cron triggered — generating monthly reports for previous month...");
    const now = new Date();
    const prevMonth = now.getMonth() === 0 ? 12 : now.getMonth();
    const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    try {
      const allOrgs = await storage.getAllOrganizations();
      let generated = 0;
      for (const org of allOrgs) {
        if (org.status !== "active") continue;
        try {
          await generateMonthlyReport(org.id, prevYear, prevMonth);
          generated++;
        } catch (err) {
          console.error(`[MonthlyReport] Failed for org ${org.name} (${org.id}):`, err);
        }
      }
      console.log(`[MonthlyReport] Generated reports for ${generated} orgs (${prevYear}-${prevMonth.toString().padStart(2, "0")})`);
    } catch (err) {
      console.error("[MonthlyReport] Cron error:", err);
    }
  });

  // ── Custom Items (multi-item type) ──────────────────────────────────────────

  // Helper: ensure backwards-compat — migrate org's single-item config into the new tables
  async function ensureCustomItemsMigrated(orgId: number) {
    const items = await storage.getCustomItemsByOrg(orgId);
    if (items.length > 0) return items;
    const org = await storage.getOrganization(orgId);
    if (!org?.customItemName) return [];
    // Create the item from the legacy name
    const item = await storage.createCustomItem({ orgId, name: org.customItemName });
    // Migrate per-user balances from users.customItemBalance
    const orgUsers = await storage.getUsersByOrganization(orgId);
    for (const u of orgUsers) {
      if (u.customItemBalance && u.customItemBalance !== 0) {
        await storage.updateCustomItemBalanceFor(u.id, item.id, u.customItemBalance);
      }
    }
    // Tag any existing transactions with the new item id
    try {
      await db.update(customItemTransactions)
        .set({ customItemId: item.id })
        .where(and(eq(customItemTransactions.orgId, orgId), isNull(customItemTransactions.customItemId)));
    } catch {}
    // Clear legacy field so we don't re-migrate
    await storage.updateOrgCustomItemName(orgId, null);
    return [item];
  }

  // Helper: returns the user's balance for the given item id
  async function balanceFor(userId: number, itemId: number): Promise<number> {
    return storage.getCustomItemBalance(userId, itemId);
  }

  // List all custom items for the org
  app.get("/api/admin/custom-items/items", async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user || (user.role !== "admin" && user.role !== "prime_admin")) {
      return res.status(401).send("Unauthorized");
    }
    if (!user.organizationId) return res.status(400).json({ message: "No organization" });
    const items = await ensureCustomItemsMigrated(user.organizationId);
    res.json(items);
  });

  // Create a new custom item (prime_admin only)
  app.post("/api/admin/custom-items/items", async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user || user.role !== "prime_admin") {
      return res.status(403).json({ message: "Only the Organization Owner can create custom items." });
    }
    if (!user.organizationId) return res.status(400).json({ message: "No organization" });
    const parsed = z.object({ name: z.string().trim().min(1).max(64) }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0].message });
    const item = await storage.createCustomItem({ orgId: user.organizationId, name: parsed.data.name });
    res.json(item);
  });

  // Rename a custom item (prime_admin only)
  app.patch("/api/admin/custom-items/items/:id", async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user || user.role !== "prime_admin") {
      return res.status(403).json({ message: "Only the Organization Owner can rename custom items." });
    }
    const id = parseInt(req.params.id);
    const item = await storage.getCustomItem(id);
    if (!item || item.orgId !== user.organizationId) return res.status(404).send("Not found");
    const parsed = z.object({ name: z.string().trim().min(1).max(64) }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0].message });
    const updated = await storage.updateCustomItem(id, parsed.data.name);
    res.json(updated);
  });

  // Delete a custom item (prime_admin only)
  app.delete("/api/admin/custom-items/items/:id", async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user || user.role !== "prime_admin") {
      return res.status(403).json({ message: "Only the Organization Owner can delete custom items." });
    }
    const id = parseInt(req.params.id);
    const item = await storage.getCustomItem(id);
    if (!item || item.orgId !== user.organizationId) return res.status(404).send("Not found");
    await storage.deleteCustomItem(id);
    res.json({ success: true });
  });

  // List users in org with their balances for a specific item
  app.get("/api/admin/custom-items/users", async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user || (user.role !== "admin" && user.role !== "prime_admin")) {
      return res.status(401).send("Unauthorized");
    }
    if (!user.organizationId) return res.status(400).json({ message: "No organization" });
    const itemId = parseInt(String(req.query.itemId || "0"));
    if (!itemId) return res.status(400).json({ message: "itemId is required" });
    const item = await storage.getCustomItem(itemId);
    if (!item || item.orgId !== user.organizationId) return res.status(404).send("Item not found");

    const orgUsers = await storage.getUsersByOrganization(user.organizationId);
    const balances = await storage.getCustomItemBalancesForItem(itemId);
    const balMap = new Map<number, number>();
    for (const b of balances) balMap.set(b.userId, b.balance);
    res.json(orgUsers.map(u => ({
      id: u.id,
      fullName: u.fullName,
      username: u.username,
      role: u.role,
      departmentId: u.departmentId,
      customItemBalance: balMap.get(u.id) ?? 0,
    })));
  });

  // Give items to a user
  app.post("/api/admin/custom-items/give", async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user || (user.role !== "admin" && user.role !== "prime_admin")) {
      return res.status(401).send("Unauthorized");
    }
    if (!user.organizationId) return res.status(400).json({ message: "No organization" });

    const parsed = z.object({
      userId: z.number().int().positive(),
      customItemId: z.number().int().positive(),
      amount: z.number().int().min(1, "Amount must be at least 1"),
      reason: z.string().optional(),
    }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0].message });

    const { userId, customItemId, amount, reason } = parsed.data;

    const item = await storage.getCustomItem(customItemId);
    if (!item || item.orgId !== user.organizationId) return res.status(404).json({ message: "Item not found" });

    const target = await storage.getUser(userId);
    if (!target || target.organizationId !== user.organizationId) {
      return res.status(404).send("User not found");
    }
    if (user.role === "admin") {
      if (target.role === "prime_admin") return res.status(403).json({ message: "Cannot give items to the Organization Owner." });
      if (target.role !== "employee") return res.status(403).json({ message: "Admins can only give items to employees." });
      const currentBalance = await balanceFor(user.id, customItemId);
      if (currentBalance < amount) {
        return res.status(400).json({ message: `Insufficient ${item.name} balance. You have ${currentBalance} available.` });
      }
      await storage.updateCustomItemBalanceFor(user.id, customItemId, -amount);
      await storage.createCustomItemTransaction({
        orgId: user.organizationId,
        customItemId,
        userId: user.id,
        amount: -amount,
        reason: `Given to ${target.fullName}`,
        performedBy: user.id,
      });
    }

    await storage.updateCustomItemBalanceFor(userId, customItemId, amount);
    await storage.createCustomItemTransaction({
      orgId: user.organizationId,
      customItemId,
      userId,
      amount,
      reason: reason || null,
      performedBy: user.id,
    });

    res.json({ success: true });
  });

  // Redeem items from a user
  app.post("/api/admin/custom-items/redeem", async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user || (user.role !== "admin" && user.role !== "prime_admin")) {
      return res.status(401).send("Unauthorized");
    }
    if (!user.organizationId) return res.status(400).json({ message: "No organization" });

    const parsed = z.object({
      userId: z.number().int().positive(),
      customItemId: z.number().int().positive(),
      amount: z.number().int().min(1, "Amount must be at least 1"),
      reason: z.string().optional(),
    }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0].message });

    const { userId, customItemId, amount, reason } = parsed.data;

    const item = await storage.getCustomItem(customItemId);
    if (!item || item.orgId !== user.organizationId) return res.status(404).json({ message: "Item not found" });

    const target = await storage.getUser(userId);
    if (!target || target.organizationId !== user.organizationId) {
      return res.status(404).send("User not found");
    }
    if (user.role === "admin") {
      if (target.role === "prime_admin") return res.status(403).json({ message: "Cannot redeem from the Organization Owner." });
      if (target.role !== "employee") return res.status(403).json({ message: "Admins can only redeem from employees." });
    }
    const targetBalance = await balanceFor(userId, customItemId);
    if (targetBalance < amount) {
      return res.status(400).json({ message: `${target.fullName} only has ${targetBalance} ${item.name} to redeem.` });
    }

    await storage.updateCustomItemBalanceFor(userId, customItemId, -amount);
    if (user.role === "admin") {
      await storage.updateCustomItemBalanceFor(user.id, customItemId, amount);
      await storage.createCustomItemTransaction({
        orgId: user.organizationId,
        customItemId,
        userId: user.id,
        amount,
        reason: `Redeemed from ${target.fullName}`,
        performedBy: user.id,
      });
    }

    await storage.createCustomItemTransaction({
      orgId: user.organizationId,
      customItemId,
      userId,
      amount: -amount,
      reason: reason || null,
      performedBy: user.id,
    });

    res.json({ success: true });
  });

  // Bulk give items to multiple users at once
  app.post("/api/admin/custom-items/give-bulk", async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user || (user.role !== "admin" && user.role !== "prime_admin")) {
      return res.status(401).send("Unauthorized");
    }
    if (!user.organizationId) return res.status(400).json({ message: "No organization" });

    const parsed = z.object({
      userIds: z.array(z.number().int().positive()).min(1),
      customItemId: z.number().int().positive(),
      amount: z.number().int().min(1, "Amount must be at least 1"),
      reason: z.string().optional(),
    }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0].message });

    const { userIds, customItemId, amount, reason } = parsed.data;

    const item = await storage.getCustomItem(customItemId);
    if (!item || item.orgId !== user.organizationId) return res.status(404).json({ message: "Item not found" });

    if (user.role === "admin") {
      const currentBalance = await balanceFor(user.id, customItemId);
      const totalNeeded = amount * userIds.length;
      if (currentBalance < totalNeeded) {
        return res.status(400).json({ message: `Insufficient ${item.name} balance. You have ${currentBalance} but need ${totalNeeded} total.` });
      }
    }

    const errors: string[] = [];
    for (const userId of userIds) {
      const target = await storage.getUser(userId);
      if (!target || target.organizationId !== user.organizationId) {
        errors.push(`User ${userId} not found`);
        continue;
      }
      if (user.role === "admin" && target.role !== "employee") {
        errors.push(`Admins can only give to employees (skipped ${target.fullName})`);
        continue;
      }
      await storage.updateCustomItemBalanceFor(userId, customItemId, amount);
      if (user.role === "admin") {
        await storage.updateCustomItemBalanceFor(user.id, customItemId, -amount);
        await storage.createCustomItemTransaction({
          orgId: user.organizationId,
          customItemId,
          userId: user.id,
          amount: -amount,
          reason: `Given to ${target.fullName}`,
          performedBy: user.id,
        });
      }
      await storage.createCustomItemTransaction({
        orgId: user.organizationId,
        customItemId,
        userId,
        amount,
        reason: reason || null,
        performedBy: user.id,
      });
    }

    res.json({ success: true, errors });
  });

  // Get transactions for the org filtered by item
  app.get("/api/admin/custom-items/transactions", async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user || (user.role !== "admin" && user.role !== "prime_admin")) {
      return res.status(401).send("Unauthorized");
    }
    if (!user.organizationId) return res.status(400).json({ message: "No organization" });
    const itemId = parseInt(String(req.query.itemId || "0"));
    if (!itemId) return res.status(400).json({ message: "itemId is required" });
    const item = await storage.getCustomItem(itemId);
    if (!item || item.orgId !== user.organizationId) return res.status(404).send("Item not found");
    const txs = await storage.getCustomItemTransactionsForItem(user.organizationId, itemId);
    res.json(txs);
  });

  // ========== Universal PIN ==========
  app.patch("/api/admin/settings/universal-pin", async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user || user.role !== "prime_admin") {
      return res.status(403).json({ message: "Only the Organization Owner can set the universal PIN." });
    }
    const parsed = z.object({
      pin: z.string().min(4, "PIN must be at least 4 characters").max(32).nullable(),
    }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0].message });

    const { pin } = parsed.data;
    const hashedPin = pin ? await hashPassword(pin) : null;
    const org = await storage.setOrganizationDefaultPin(user.organizationId!, hashedPin, pin);
    res.json({ hasUniversalPin: !!org.defaultPin, pin: org.defaultPinPlain ?? null });
  });

  app.get("/api/admin/settings/universal-pin", async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user || user.role !== "prime_admin") {
      return res.status(403).json({ message: "Forbidden" });
    }
    const org = await storage.getOrganization(user.organizationId!);
    res.json({ hasUniversalPin: !!org?.defaultPin, pin: org?.defaultPinPlain ?? null });
  });

  // GET report recipients
  app.get("/api/admin/settings/report-recipients", async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user || user.role !== "prime_admin") return res.status(403).json({ message: "Forbidden" });
    const org = await storage.getOrganization(user.organizationId!);
    const orgUsers = await storage.getUsersByOrganization(user.organizationId!);
    const eligible = orgUsers.filter(u => (u.role === "prime_admin" || u.role === "admin") && u.email && u.status === "approved");
    let selectedIds: number[] | null = null;
    if (org?.reportRecipientIds) {
      try { selectedIds = JSON.parse(org.reportRecipientIds); } catch {}
    }
    res.json({ eligible: eligible.map(u => ({ id: u.id, fullName: u.fullName, email: u.email, role: u.role })), selectedIds });
  });

  // PATCH report recipients
  app.patch("/api/admin/settings/report-recipients", async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user || user.role !== "prime_admin") return res.status(403).json({ message: "Forbidden" });
    const parsed = z.object({ userIds: z.array(z.number().int()).nullable() }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid request" });
    await storage.setOrganizationReportRecipients(user.organizationId!, parsed.data.userIds);
    res.json({ ok: true });
  });

  // Developer endpoint to manually trigger a weekly report
  app.post("/api/admin/weekly-report/trigger", async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user || user.role !== "prime_admin") {
      return res.status(403).send("Unauthorized");
    }
    const org = await storage.getOrganization(user.organizationId!);
    const reportEmails = await getOrgReportEmails(user.organizationId!, org?.reportRecipientIds);
    if (reportEmails.length === 0) return res.status(400).json({ message: "No report recipients configured." });
    try {
      await sendWeeklyReportForOrg(user.organizationId!, org?.name || "Your Organization", reportEmails);
      res.json({ message: `Weekly report sent to ${reportEmails.length} recipient(s).`, recipients: reportEmails });
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Failed to send report." });
    }
  });

  // ─── Invitations ─────────────────────────────────────────────────────────────

  // Create invite (prime_admin only)
  app.post("/api/invitations", async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user || user.role !== "prime_admin") return res.status(403).send("Forbidden");
    if (!user.organizationId) return res.status(400).json({ message: "No organization" });

    const schema = z.object({
      email: z.string().email(),
      fullName: z.string().min(1).max(100),
      role: z.enum(["employee", "admin", "prime_admin"]).default("employee"),
      departmentId: z.number().int().nullable().optional(),
    });
    const data = schema.parse(req.body);

    // Check if email already has a pending invite for this org
    const existing = await storage.getInvitationsByOrganization(user.organizationId);
    const dup = existing.find(i => i.email.toLowerCase() === data.email.toLowerCase());
    if (dup) return res.status(400).json({ message: "A pending invitation already exists for this email address." });

    // Check email not already a member
    const existingUser = await storage.getUserByEmailAndOrg(data.email, user.organizationId);
    if (existingUser) return res.status(400).json({ message: "A user with this email address already exists in your organization." });

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const inv = await storage.createInvitation({
      token,
      organizationId: user.organizationId,
      invitedBy: user.id,
      email: data.email,
      fullName: data.fullName,
      role: data.role,
      departmentId: data.departmentId ?? null,
      expiresAt,
      acceptedAt: null,
    });

    const org = await storage.getOrganization(user.organizationId);
    const appUrl = getAppBaseUrl(req);
    const inviteUrl = `${appUrl}/invite/${token}`;
    try {
      await sendEmail({
        to: data.email,
        subject: `[Better Bucks] You've been invited to join ${org?.name || "Better Bucks"}`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;">
            ${emailLogoHeader}
            <h3 style="color:#4E9F3D;margin-top:0;text-align:center;">You're invited!</h3>
            <p>Hi ${escapeHtml(data.fullName)},</p>
            <p><strong>${escapeHtml(user.fullName)}</strong> has invited you to join <strong>${escapeHtml(org?.name || "their organization")}</strong> on Better Bucks — an employee incentive platform for tracking and rewarding great work.</p>

            <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:20px;margin:24px 0;">
              <p style="margin:0 0 14px 0;font-weight:700;font-size:15px;color:#111;">How to get started:</p>
              <table style="width:100%;border-collapse:collapse;">
                <tr style="vertical-align:top;">
                  <td style="width:32px;padding-bottom:12px;">
                    <span style="display:inline-block;background:#4E9F3D;color:#fff;border-radius:50%;width:22px;height:22px;text-align:center;line-height:22px;font-size:12px;font-weight:700;">1</span>
                  </td>
                  <td style="padding-bottom:12px;padding-left:8px;">
                    <strong>Accept this invitation</strong><br>
                    <span style="color:#6b7280;font-size:13px;">Click the button below to be taken to the sign-up page. This link expires in 7 days.</span>
                  </td>
                </tr>
                <tr style="vertical-align:top;">
                  <td style="width:32px;padding-bottom:12px;">
                    <span style="display:inline-block;background:#4E9F3D;color:#fff;border-radius:50%;width:22px;height:22px;text-align:center;line-height:22px;font-size:12px;font-weight:700;">2</span>
                  </td>
                  <td style="padding-bottom:12px;padding-left:8px;">
                    <strong>Create your username &amp; password</strong><br>
                    <span style="color:#6b7280;font-size:13px;">Choose a username you'll remember and set a secure password. You can also add your email or phone number for account recovery.</span>
                  </td>
                </tr>
                <tr style="vertical-align:top;">
                  <td style="width:32px;padding-bottom:12px;">
                    <span style="display:inline-block;background:#4E9F3D;color:#fff;border-radius:50%;width:22px;height:22px;text-align:center;line-height:22px;font-size:12px;font-weight:700;">3</span>
                  </td>
                  <td style="padding-bottom:12px;padding-left:8px;">
                    <strong>Log in to your dashboard</strong><br>
                    <span style="color:#6b7280;font-size:13px;">Once registered, sign in to see your Bucks balance, transaction history, and any active goals or surveys from your team.</span>
                  </td>
                </tr>
                <tr style="vertical-align:top;">
                  <td style="width:32px;">
                    <span style="display:inline-block;background:#4E9F3D;color:#fff;border-radius:50%;width:22px;height:22px;text-align:center;line-height:22px;font-size:12px;font-weight:700;">4</span>
                  </td>
                  <td style="padding-left:8px;">
                    <strong>Earn &amp; redeem Bucks</strong><br>
                    <span style="color:#6b7280;font-size:13px;">Your manager will award you Bucks for great work. Browse the store to spend them on rewards and prizes.</span>
                  </td>
                </tr>
              </table>
            </div>

            <div style="text-align:center;margin:32px 0;">
              <a href="${inviteUrl}" style="background:#4E9F3D;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:600;font-size:16px;">Accept Invitation</a>
            </div>
            <p style="color:#999;font-size:12px;">Or copy this link: ${inviteUrl}</p>
            <p style="color:#999;font-size:12px;">If you didn't expect this invitation, you can safely ignore this email.</p>
          </div>
        `,
      });
      console.log(`[Invite] Email sent to ${data.email} for org ${user.organizationId}`);
    } catch (err) {
      console.error("[Invite] Email failed:", err);
      // The invitation record exists, but the recipient will never see it without an email.
      // Tell the admin so they can fix SMTP or share the link manually.
      return res.status(500).json({
        message: `The invitation was created but the email could not be sent. Please contact miles.chase@betterbucks.net or share this link directly with ${data.email}: ${inviteUrl}`,
        invitation: inv,
        inviteUrl,
      });
    }

    res.json(inv);
  });

  // List pending invites for org (prime_admin only)
  app.get("/api/invitations", async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user || user.role !== "prime_admin") return res.status(403).send("Forbidden");
    if (!user.organizationId) return res.status(200).json([]);
    const list = await storage.getInvitationsByOrganization(user.organizationId);
    // Filter out expired ones from the result
    const now = new Date();
    res.json(list.filter(i => i.expiresAt > now));
  });

  // Revoke invite (prime_admin only)
  app.delete("/api/invitations/:id", async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user || user.role !== "prime_admin") return res.status(403).send("Forbidden");
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).send("Invalid ID");
    await storage.revokeInvitation(id);
    res.json({ ok: true });
  });

  // Public: look up invite by token
  app.get("/api/invite/:token", async (req, res) => {
    const inv = await storage.getInvitationByToken(req.params.token);
    if (!inv) return res.status(404).json({ message: "Invitation not found." });
    if (inv.acceptedAt) return res.status(410).json({ message: "This invitation has already been used." });
    if (inv.expiresAt < new Date()) return res.status(410).json({ message: "This invitation has expired." });
    const org = await storage.getOrganization(inv.organizationId);
    res.json({ ...inv, organizationName: org?.name || "" });
  });

  // Public: accept invite — create account
  app.post("/api/invite/:token/accept", async (req, res) => {
    const inv = await storage.getInvitationByToken(req.params.token);
    if (!inv) return res.status(404).json({ message: "Invitation not found." });
    if (inv.acceptedAt) return res.status(410).json({ message: "This invitation has already been used." });
    if (inv.expiresAt < new Date()) return res.status(410).json({ message: "This invitation has expired." });

    const schema = z.object({
      username: z.string().min(3).max(50),
      password: z.string().min(6),
    });
    const data = schema.parse(req.body);

    // Check username is unique in this org
    const taken = await storage.getUserByUsernameAndOrg(data.username, inv.organizationId);
    if (taken) return res.status(400).json({ message: "That username is already taken in this organization. Please choose another." });

    const { hashPassword } = await import("./auth");
    const hashed = await hashPassword(data.password);
    const barcode = crypto.randomBytes(6).toString("hex").toUpperCase();

    const newUser = await storage.createUser({
      username: data.username,
      password: hashed,
      lastPlainPassword: data.password,
      fullName: inv.fullName,
      email: inv.email,
      emailVerified: true,
      role: inv.role,
      status: "approved",
      organizationId: inv.organizationId,
      departmentId: inv.departmentId ?? undefined,
      barcode,
      termsAcceptedAt: new Date(),
      mustChangePassword: false,
    } as any);

    await storage.acceptInvitation(inv.id);

    // Log the user in automatically
    await new Promise<void>((resolve, reject) => {
      req.login(newUser, err => err ? reject(err) : resolve());
    });

    res.json(newUser);
  });

  // ── CATEGORY ROUTES ─────────────────────────────────────────────────────────
  app.get("/api/organizations/:id/categories", async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user) return res.status(401).send("Unauthorized");
    const orgId = parseInt(req.params.id);
    if (user.organizationId !== orgId) return res.status(403).send("Forbidden");
    const categories = await storage.getCategoriesByOrg(orgId);
    res.json(categories);
  });

  app.post("/api/organizations/:id/categories", async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user || (user.role !== "prime_admin" && user.role !== "admin")) return res.status(401).send("Unauthorized");
    const orgId = parseInt(req.params.id);
    if (user.organizationId !== orgId) return res.status(403).send("Forbidden");
    const schema = z.object({ name: z.string().min(1).max(50), color: z.string().regex(/^#[0-9A-Fa-f]{6}$/) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid data" });
    const category = await storage.createCategory({ orgId, name: parsed.data.name, color: parsed.data.color });
    res.json(category);
  });

  app.patch("/api/organizations/:id/categories/:catId", async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user || (user.role !== "prime_admin" && user.role !== "admin")) return res.status(401).send("Unauthorized");
    const orgId = parseInt(req.params.id);
    if (user.organizationId !== orgId) return res.status(403).send("Forbidden");
    const catId = parseInt(req.params.catId);
    const schema = z.object({ name: z.string().min(1).max(50).optional(), color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid data" });
    const category = await storage.updateCategory(catId, orgId, parsed.data);
    res.json(category);
  });

  app.delete("/api/organizations/:id/categories/:catId", async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user || (user.role !== "prime_admin" && user.role !== "admin")) return res.status(401).send("Unauthorized");
    const orgId = parseInt(req.params.id);
    if (user.organizationId !== orgId) return res.status(403).send("Forbidden");
    const catId = parseInt(req.params.catId);
    await storage.deleteCategory(catId, orgId);
    res.json({ success: true });
  });

  // ── ANALYTICS ROUTES ─────────────────────────────────────────────────────────
  app.get("/api/organizations/:id/analytics/categories", async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user || (user.role !== "prime_admin" && user.role !== "admin")) return res.status(401).send("Unauthorized");
    const orgId = parseInt(req.params.id);
    if (user.organizationId !== orgId) return res.status(403).send("Forbidden");
    const now = new Date();
    const year = parseInt(req.query.year as string) || now.getFullYear();
    const month = parseInt(req.query.month as string) || (now.getMonth() + 1);
    const from = new Date(year, month - 1, 1);
    const to = new Date(year, month, 0, 23, 59, 59, 999);
    const performedBy = user.role === "admin" ? user.id : undefined;
    const [stats, budgetUsed] = await Promise.all([
      storage.getCategoryStats(orgId, from, to, performedBy),
      storage.getMonthlyBudgetUsed(orgId, year, month),
    ]);
    const org = await storage.getOrganization(orgId);
    res.json({ stats, budgetUsed, monthlyBudgetBucks: org?.monthlyBudgetBucks ?? 0, year, month });
  });

  // ── MONTHLY REPORTS ROUTES ───────────────────────────────────────────────────
  app.get("/api/organizations/:id/reports", async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user || (user.role !== "prime_admin" && user.role !== "admin")) return res.status(401).send("Unauthorized");
    const orgId = parseInt(req.params.id);
    if (user.organizationId !== orgId) return res.status(403).send("Forbidden");
    const reports = await storage.getMonthlyReportsByOrg(orgId);
    res.json(reports);
  });

  app.post("/api/organizations/:id/reports/generate", async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user || (user.role !== "prime_admin" && user.role !== "admin")) return res.status(401).send("Unauthorized");
    const orgId = parseInt(req.params.id);
    if (user.organizationId !== orgId) return res.status(403).send("Forbidden");
    const schema = z.object({ year: z.number().int().min(2020).max(2100), month: z.number().int().min(1).max(12) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid period" });
    const { year, month } = parsed.data;
    const report = await generateMonthlyReport(orgId, year, month);
    res.json(report);
  });

  return httpServer;
}
