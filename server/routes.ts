
import type { Express, Request, Response, NextFunction } from "express";
import { seedDemoOrg } from "./seedDemo";
import type { Server } from "http";
import { setupAuth, hashPassword, verifyPassword, generateCaptchaChallenge, verifyCaptchaToken, isCaptchaRequired } from "./auth";
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
import { ensureStripeReady } from "./stripeLazy";
import { getUncachableStripeClient, getStripePublishableKey } from "./stripeClient";

async function getStripeClient() {
  return getUncachableStripeClient();
}

async function getStripePubKey() {
  return getStripePublishableKey();
}
import { sql, eq, and, gte, lte, gt, lt, inArray } from "drizzle-orm";
import { db } from "./db";
import { organizations, users, infoRequests, transactions, orders } from "@shared/schema";
import type { User } from "@shared/schema";

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

async function sendEmail({ to, subject, html, text }: { to: string; subject: string; html: string; text?: string }): Promise<void> {
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  if (!smtpUser || !smtpPass) {
    const msg = `SMTP not configured — SMTP_USER / SMTP_PASS env vars are missing. Cannot send "${subject}" to ${to}.`;
    console.error(`[Email] ${msg}`);
    throw new Error(msg);
  }
  const smtpHost = process.env.SMTP_HOST || "smtp.gmail.com";
  const smtpPort = parseInt(process.env.SMTP_PORT || "587");
  const nm = await import("nodemailer");
  const transporter = nm.default.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: { user: smtpUser, pass: smtpPass },
  });
  try {
    await transporter.sendMail({
      from: `"Better Bucks" <${smtpUser}>`,
      to,
      subject,
      html,
      ...(text ? { text } : {}),
    });
    console.log(`[Email] Sent "${subject}" to ${to}`);
  } catch (err: any) {
    console.error(`[Email] Failed to send "${subject}" to ${to}:`, err?.message ?? err);
    throw err;
  }
}

const ADMIN_NOTIFY_EMAIL = "miles.chase@betterbucks.net";

async function getOrgPrimeAdminEmail(organizationId: number): Promise<string | null> {
  const orgUsers = await storage.getUsersByOrganization(organizationId);
  const primeAdmin = orgUsers.find(u => u.role === "prime_admin" && u.email);
  return primeAdmin?.email ?? null;
}

async function notifyAdmin(to: string, subject: string, details: Record<string, string>): Promise<void> {
  const rows = Object.entries(details)
    .map(([k, v]) => `<tr><td style="padding:4px 8px;color:#666;font-weight:500;white-space:nowrap">${k}</td><td style="padding:4px 8px;">${v || "—"}</td></tr>`)
    .join("");
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;">
      <h2 style="color:#162A4A;margin-bottom:4px;">Better Bucks</h2>
      <h3 style="color:#4E9F3D;margin-top:0;">${subject}</h3>
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
          <h2 style="color: #162A4A;">Better Bucks</h2>
          <p>Hi ${fullName},</p>
          <p>Your verification code is:</p>
          <div style="background: #EEF4FB; padding: 16px; border-radius: 8px; text-align: center; font-size: 32px; letter-spacing: 6px; font-weight: bold; color: #162A4A;">${code}</div>
          <p style="margin-top: 16px; color: #666;">Enter this code in the app to verify your email address.</p>
        </div>
      `,
    });
  } catch (err) {
    console.error(`[Email Verification] Failed to send to ${email}:`, err);
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
      console.log(`[SMS Verification] Twilio not configured. Code for ${phone}: ${code}`);
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
    console.log(`[SMS Verification] Sent to ${phone}`);
  } catch (err) {
    console.error(`[SMS Verification] Failed to send to ${phone}:`, err);
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

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Setup Auth first
  setupAuth(app);

  // ── Public demo read-only guard ──────────────────────────────────────────
  // For public demo sessions, block all writes so the shared demo org stays
  // in its base state. Demo-switching and logout paths are allowed through.
  // Tutorial endpoints must pass through so the overlay only appears once per session,
  // not repeatedly. The demo login resets tutorialCompleted=false so it fires fresh
  // for each new visitor.
  const DEMO_WRITE_ALLOWLIST = ["/api/demo/", "/api/logout", "/api/users/complete-tutorial", "/api/users/reset-tutorial"];
  app.use((req, _res, next) => {
    const isPublicDemo = (req.session as any)?.isPublicDemo === true;
    if (
      isPublicDemo &&
      ["POST", "PATCH", "PUT", "DELETE"].includes(req.method) &&
      !DEMO_WRITE_ALLOWLIST.some((p) => req.path.startsWith(p))
    ) {
      // Return a generic success so the UI doesn't error, but nothing is saved
      _res.status(200).json({ ok: true });
      return;
    }
    next();
  });

  // Seed default blog posts if none exist (handles fresh production databases)
  await seedBlogPosts();

  // Seed demo org after startup so health checks are never blocked
  setTimeout(() => seedDemoOrg(), 5000);

  // robots.txt
  app.get("/robots.txt", (_req, res) => {
    res.type("text/plain").send(
      [
        "User-agent: *",
        "Allow: /",
        // App/auth pages — not indexable content
        "Disallow: /api/",
        "Disallow: /dashboard",
        "Disallow: /store",
        "Disallow: /orders",
        "Disallow: /settings",
        "Disallow: /admin",
        "Disallow: /login",
        "Disallow: /signup",
        "Disallow: /forgot-password",
        "Disallow: /reset-password",
        "Disallow: /change-password",
        "Disallow: /reactivate",
        "Disallow: /setup",
        "Disallow: /verify-email",
        "Disallow: /pending-verification",
        "Disallow: /developer",
        // /how-it-works is canonical at / — block the duplicate
        "Disallow: /how-it-works",
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
      { loc: "/about", priority: "0.8", changefreq: "monthly", lastmod: today },
      { loc: "/blog", priority: "0.9", changefreq: "weekly", lastmod: today },
      { loc: "/terms", priority: "0.3", changefreq: "yearly", lastmod: today },
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
    if (user.role === "admin") {
      allUsers = allUsers.filter(u => u.departmentId === user.departmentId);
    }
    res.json(allUsers);
  });

  // Forgot password — send 6-digit reset code via email or phone
  app.post("/api/auth/forgot-password", asyncHandler(async (req, res) => {
    const { contact } = z.object({ contact: z.string().min(1) }).parse(req.body);
    const isEmail = contact.includes("@");
    const user = isEmail
      ? await storage.getUserByEmailGlobal(contact.toLowerCase().trim())
      : await storage.getUserByPhoneGlobal(contact.trim());

    // Always return success to avoid account enumeration
    const genericMsg = "If an account with that contact exists, a reset code has been sent.";
    if (!user) return res.json({ message: genericMsg });

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await storage.setPasswordResetToken(user.id, code, expiry);

    if (isEmail && user.email) {
      try {
        await sendEmail({
          to: user.email,
          subject: "Reset your Better Bucks password",
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
              <h2 style="color: #162A4A;">Better Bucks</h2>
              <p>Hi ${user.fullName},</p>
              <p>We received a request to reset your password. Your reset code is:</p>
              <div style="background: #EEF4FB; padding: 16px; border-radius: 8px; text-align: center; font-size: 36px; letter-spacing: 8px; font-weight: bold; color: #162A4A;">${code}</div>
              <p style="margin-top: 16px; color: #666;">This code expires in 1 hour. If you did not request a password reset, please ignore this email.</p>
            </div>
          `,
        });
      } catch (err) {
        console.error("[Password Reset] Email failed:", err);
      }
    } else if (!isEmail && user.phone) {
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      const fromNumber = process.env.TWILIO_PHONE_NUMBER;
      if (accountSid && authToken && fromNumber) {
        try {
          await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
            method: "POST",
            headers: {
              "Authorization": "Basic " + Buffer.from(`${accountSid}:${authToken}`).toString("base64"),
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              To: user.phone,
              From: fromNumber,
              Body: `Your Better Bucks password reset code is: ${code}. It expires in 1 hour.`,
            }),
          });
        } catch (err) {
          console.error("[Password Reset] SMS failed:", err);
        }
      } else {
        console.log(`[Password Reset] Twilio not configured. Code for ${user.phone}: ${code}`);
      }
    }

    res.json({ message: genericMsg });
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
      if (!hasEmail && !hasPhone) {
        return res.status(400).json({ message: "Please provide either a valid email address or phone number" });
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
        fullName: adminData.fullName,
        email: hasEmail ? adminEmail : null,
        phone: hasPhone ? adminPhone : null,
        emailVerificationCode: verificationCode,
        role: "admin",
        barcode: adminData.username,
        status: "pending",
        organizationId: org.id,
      });

      await sendVerificationCode(hasEmail ? adminEmail : null, hasPhone ? adminPhone : null, verificationCode, adminData.fullName);
      const orgPrimeEmail = await getOrgPrimeAdminEmail(org.id);
      if (orgPrimeEmail) {
        notifyAdmin(orgPrimeEmail, "New Admin Account — Pending Approval", {
          "Name": adminData.fullName,
          "Username": adminData.username,
          "Organization": org.name,
          "Email": adminEmail || "—",
          "Phone": adminPhone || "—",
          "Status": "Pending verification",
        });
      }
      console.log(`New admin registration: ${user.username} for org ${org.name} (pending)`);
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
        fullName: empData.fullName,
        email: hasEmail ? empEmail : null,
        phone: hasPhone ? empPhone : null,
        emailVerificationCode: verificationCode,
        role: "employee",
        barcode: empData.username,
        status: "pending",
        organizationId: org.id,
      });

      await sendVerificationCode(hasEmail ? empEmail : null, hasPhone ? empPhone : null, verificationCode, empData.fullName);
      const orgPrimeEmail = await getOrgPrimeAdminEmail(org.id);
      if (orgPrimeEmail) {
        notifyAdmin(orgPrimeEmail, "New Employee Account — Pending Approval", {
          "Name": empData.fullName,
          "Username": empData.username,
          "Organization": org.name,
          "Email": empEmail || "—",
          "Phone": empPhone || "—",
          "Status": "Pending admin approval",
        });
      }
      console.log(`New employee registration: ${user.username} for org ${org.name} (pending approval)`);
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
      res.json({ orgName: org.name, siteId: org.siteId, employeeRoleLabel: org.employeeRoleLabel });
    } catch (e) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  // Public: employee login or self-registration via Site ID (no password)
  app.post("/api/join", async (req, res) => {
    try {
      const { siteId, username, fullName } = req.body;
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
        return res.status(200).json({ needsRegistration: true });
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

      // Create passwordless employee — store a random unhashable placeholder
      const randomPass = crypto.randomBytes(32).toString("hex");
      const user = await storage.createUser({
        username: trimmedUsername,
        password: await hashPassword(randomPass),
        fullName: trimmedFullName,
        email: null,
        phone: null,
        emailVerified: true,
        role: "employee",
        barcode: trimmedUsername,
        status: "approved",
        organizationId: org.id,
      });

      const orgPrimeEmail = await getOrgPrimeAdminEmail(org.id);
      if (orgPrimeEmail) {
        notifyAdmin(orgPrimeEmail, "New Employee Account — QR Registration", {
          "Name": trimmedFullName,
          "Username": trimmedUsername,
          "Organization": org.name,
          "Method": "QR Code / Site ID",
          "Status": "Approved",
        }).catch(() => {});
      }

      req.login(user, async (err) => {
        if (err) return res.status(500).json({ message: "Registration failed" });
        return res.status(201).json(user);
      });
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

      // Admins and prime_admins must have email or phone; employees can be passwordless
      if (!isEmployee && !hasEmail && !hasPhone) {
        return res.status(400).json({ message: "Please provide either a valid email address or phone number for admin accounts" });
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
      const userPassword = userData.password && userData.password.length >= 6
        ? await hashPassword(userData.password)
        : await hashPassword(crypto.randomBytes(32).toString("hex"));

      const verificationCode = (hasEmail || hasPhone)
        ? Math.floor(100000 + Math.random() * 900000).toString()
        : null;

      const newUser = await storage.createUser({
        ...userData,
        password: userPassword,
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
        await sendVerificationCode(hasEmail ? empEmail : null, hasPhone ? empPhone : null, verificationCode!, userData.fullName);
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

  app.get(api.users.get.path, async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user) return res.status(401).send("Unauthorized");
    
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).send("Invalid ID");

    if (user.role !== "admin" && user.role !== "prime_admin" && user.id !== id) {
      return res.status(403).send("Forbidden");
    }

    const userResult = await storage.getUser(id);
    if (!userResult) return res.status(404).send("User not found");

    if (user.role === "admin" && user.id !== id && userResult.departmentId !== user.departmentId) {
      return res.status(403).send("Forbidden");
    }

    const transactions = await storage.getTransactionsByUser(id);
    res.json({ ...userResult, transactions });
  });

  app.post(api.users.bulkCredit.path, async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user || (user.role !== "admin" && user.role !== "prime_admin")) {
      return res.status(401).send("Unauthorized");
    }

    const { userIds, amount, reason } = api.users.bulkCredit.input.parse(req.body);

    // For non-prime admins, check if they have enough balance for all users
    if (user.role !== "prime_admin") {
      const totalCost = amount * userIds.length;
      if (user.balance < totalCost) {
        return res.status(400).json({
          message: `Insufficient balance. Need ${totalCost.toLocaleString()} pts to credit ${userIds.length} employees (${amount.toLocaleString()} pts each), but only have ${user.balance.toLocaleString()} pts.`,
        });
      }
    }

    let credited = 0;
    for (const targetId of userIds) {
      const targetUser = await storage.getUser(targetId);
      if (!targetUser) continue;

      // Cannot credit yourself
      if (targetUser.id === user.id) continue;

      // Department isolation for non-prime admins
      if (user.role === "admin" && targetUser.departmentId !== user.departmentId) continue;

      // Deduct from admin balance (non-prime) or just record transaction (prime)
      if (user.role !== "prime_admin") {
        await storage.updateUserBalance(user.id, -amount);
        await storage.createTransaction({
          userId: user.id,
          amount: -amount,
          reason: `Bucks given to ${targetUser.fullName}`,
          performedBy: user.id,
        });
      } else {
        await storage.createTransaction({
          userId: user.id,
          amount: -amount,
          reason: `Bucks given to ${targetUser.fullName}`,
          performedBy: user.id,
        });
      }

      await storage.updateUserBalance(targetId, amount);
      await storage.createTransaction({
        userId: targetId,
        amount,
        reason,
        performedBy: user.id,
      });
      credited++;
    }

    res.json({ credited });
  });

  app.post(api.users.updateBalance.path, async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user || (user.role !== "admin" && user.role !== "prime_admin")) {
      return res.status(401).send("Unauthorized");
    }

    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).send("Invalid ID");

    const { amount, reason } = api.users.updateBalance.input.parse(req.body);

    const targetUser = await storage.getUser(id);
    if (!targetUser) return res.status(404).send("User not found");

    if (user.role === "admin" && targetUser.departmentId !== user.departmentId) {
      return res.status(403).send("Forbidden");
    }

    // If not prime admin, deduct from current admin balance
    if (user.role !== "prime_admin") {
      // For credits (giving Bucks)
      if (amount > 0) {
        if (user.balance < amount) {
          return res.status(400).json({ message: "Insufficient balance to award Bucks" });
        }
        // Deduct from admin
        await storage.updateUserBalance(user.id, -amount);
        await storage.createTransaction({
          userId: user.id,
          amount: -amount,
          reason: `Bucks given to ${targetUser.fullName}`,
          performedBy: user.id,
        });
      }
    } else {
      // Prime admin also gets a debit record when giving Bucks
      if (amount > 0) {
        await storage.createTransaction({
          userId: user.id,
          amount: -amount,
          reason: `Bucks given to ${targetUser.fullName}`,
          performedBy: user.id,
        });
      }
    }

    const updatedUser = await storage.updateUserBalance(id, amount);
    await storage.createTransaction({
      userId: id,
      amount,
      reason,
      performedBy: user.id,
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

    // Prevent changing role of prime_admin
    if (targetUser.role === "prime_admin") {
      return res.status(400).send("Cannot change role of prime administrator");
    }

    const { role } = api.users.updateRole.input.parse(req.body);

    const updatedUser = await storage.updateUserRole(id, role as "admin" | "employee");
    res.json(updatedUser);
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
    const profileData: any = { username: data.username, password: data.password, email: data.email };
    if (isPrime && data.departmentId !== undefined) {
      profileData.departmentId = data.departmentId;
    }
    const updatedUser = await storage.updateUserProfile(id, profileData);
    res.json(updatedUser);
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

    // Users can delete their own account (except prime admins)
    if (user.id === id) {
      if (user.role === "prime_admin") return res.status(400).send("Cannot delete prime account");
      await storage.deleteUser(id);
      req.logout(() => {});
      return res.sendStatus(200);
    }

    // Prime can delete anyone except themselves or other prime admins
    if (isPrime) {
      if (targetUser.role === "prime_admin") return res.status(400).send("Cannot delete prime account");
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
    res.json(updated);
  });

  // Get pending admins (prime account only)
  app.get("/api/users/pending-admins", async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user || user.role !== "prime_admin") {
      return res.status(401).send("Unauthorized");
    }
    try {
      const pendingAdmins = user.organizationId 
        ? await storage.getPendingAdminsByOrganization(user.organizationId)
        : await storage.getPendingAdmins();
      res.json(pendingAdmins);
    } catch (error) {
      console.error("Error fetching pending admins:", error);
      res.status(500).send("Internal Server Error");
    }
  });

  // Approve pending admin (prime account only, same org)
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
      const approvedUser = await storage.approveAdminUser(id);
      res.json(approvedUser);
    } catch (error) {
      console.error("Error approving admin:", error);
      res.status(500).send("Internal Server Error");
    }
  });

  // Reject/Delete pending admin (prime account only)
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
  }, async (req, res, next) => { const u = await getUpload(); u.array("photos", 10)(req, res, next); }, (req: any, res: any) => {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) return res.status(400).json({ message: "No files uploaded" });
    const urls = files.map(f => `/uploads/${f.filename}`);
    res.json({ urls });
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
    if (!req.isAuthenticated() || !user || (user.role !== "admin" && user.role !== "prime_admin")) {
      return res.status(401).send("Unauthorized");
    }

    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).send("Invalid ID");

    const parsed = updateOrderStatusSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0].message });
    const { status, adminNotes } = parsed.data;

    const order = await storage.getOrder(id);
    if (!order) return res.status(404).send("Order not found");

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
    small:      { price: 2499,  maxEmployees: 25,  name: "Small Site",      description: "Up to 25 employees — includes 60-day free pilot, admin dashboard, Bucks tracking, basic reporting, and email support." },
    mid:        { price: 4999,  maxEmployees: 75,  name: "Mid-Size Site",   description: "26–75 employees — includes 60-day free pilot, admin dashboard, Bucks tracking, advanced reporting, and priority support." },
    large:      { price: 7499,  maxEmployees: 150, name: "Large Site",      description: "76–150 employees — includes 60-day free pilot, admin dashboard, Bucks tracking, advanced reporting, and priority support." },
    enterprise: { price: 14999, maxEmployees: -1,  name: "Enterprise Site", description: "150+ employees — includes 60-day free pilot, unlimited logins, admin dashboard, Bucks tracking, custom reporting, and dedicated support." },
  } as const;

  // Organization signup - create checkout session
  const signupSchema = z.object({
    organizationName: z.string().min(2, "Organization name is required"),
    email: z.string().email("Valid email is required"),
    tier: z.enum(["small", "mid", "large", "enterprise"]),
    referralCode: z.string().optional(),
    licenseAccepted: z.boolean().refine(v => v === true, { message: "You must agree to the Terms of Service and Software License Agreement to proceed." }),
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
      small: "$24.99/mo", mid: "$49.99/mo", large: "$74.99/mo", enterprise: "$149.99/mo",
    };

    let validatedReferral: { code: string; extraMonths: number } | null = null;
    if (referralCode && referralCode.trim()) {
      const refRow = await storage.getReferralCode(referralCode.trim());
      if (refRow && refRow.active) validatedReferral = { code: refRow.code, extraMonths: refRow.extraMonths };
    }

    const modeLabel = mode === "stripe" ? "💳 NEW STRIPE SUBSCRIPTION" : mode === "promo" ? "🎟️ PROMO CODE SIGNUP (GOKU11)" : "⭐ FOUNDER PRICING REQUEST";
    const referralRow = validatedReferral
      ? `<tr><td style="padding:8px 12px;font-weight:600;color:#fff;background:#1d6a2e;border:1px solid #166534">🎁 Referral Code</td><td style="padding:8px 12px;background:#dcfce7;border:1px solid #166534;font-weight:700;color:#166534">${validatedReferral.code} — +${validatedReferral.extraMonths} free month${validatedReferral.extraMonths > 1 ? "s" : ""}</td></tr>`
      : referralCode && referralCode.trim()
        ? `<tr><td style="padding:8px 12px;font-weight:600;color:#374151;background:#fff;border:1px solid #e5e7eb">Referral Code</td><td style="padding:8px 12px;background:#fff;border:1px solid #e5e7eb;color:#dc2626">${referralCode.trim()} (invalid)</td></tr>`
        : "";
    const referralText = validatedReferral
      ? `\nReferral Code: ${validatedReferral.code} ✅ (+${validatedReferral.extraMonths} free month${validatedReferral.extraMonths > 1 ? "s" : ""})`
      : referralCode?.trim() ? `\nReferral Code: ${referralCode.trim()} (invalid)` : "";

    sendEmail({
      to: ADMIN_NOTIFY_EMAIL,
      subject: `${modeLabel} – ${config.name} – ${organizationName}${validatedReferral ? " 🎁" : ""}`,
      html: `<div style="font-family:sans-serif;max-width:520px">
<div style="background:#162A4A;color:#fff;padding:16px 20px;border-radius:8px 8px 0 0">
  <p style="margin:0;font-size:11px;letter-spacing:1px;text-transform:uppercase;opacity:0.7">Better Bucks</p>
  <h2 style="margin:4px 0 0;font-size:20px">${modeLabel}</h2>
</div>
<div style="background:#f9fafb;padding:20px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px">
  <table style="border-collapse:collapse;width:100%">
    <tr><td style="padding:8px 12px;font-weight:600;color:#374151;background:#fff;border:1px solid #e5e7eb;width:38%">Company</td><td style="padding:8px 12px;background:#fff;border:1px solid #e5e7eb">${organizationName}</td></tr>
    <tr><td style="padding:8px 12px;font-weight:600;color:#374151;background:#f9fafb;border:1px solid #e5e7eb">Contact Email</td><td style="padding:8px 12px;background:#f9fafb;border:1px solid #e5e7eb"><a href="mailto:${email}" style="color:#162A4A">${email}</a></td></tr>
    <tr><td style="padding:8px 12px;font-weight:600;color:#374151;background:#fff;border:1px solid #e5e7eb">Plan</td><td style="padding:8px 12px;background:#fff;border:1px solid #e5e7eb"><strong>${config.name}</strong></td></tr>
    <tr><td style="padding:8px 12px;font-weight:600;color:#374151;background:#f9fafb;border:1px solid #e5e7eb">Monthly Rate</td><td style="padding:8px 12px;background:#f9fafb;border:1px solid #e5e7eb">${planPrices[tier]}</td></tr>
    <tr><td style="padding:8px 12px;font-weight:600;color:#374151;background:#fff;border:1px solid #e5e7eb">Employee Limit</td><td style="padding:8px 12px;background:#fff;border:1px solid #e5e7eb">${config.maxEmployees === -1 ? "Unlimited (Enterprise)" : `Up to ${config.maxEmployees} employees`}</td></tr>
    <tr><td style="padding:8px 12px;font-weight:600;color:#374151;background:#f9fafb;border:1px solid #e5e7eb">Org Code</td><td style="padding:8px 12px;background:#f9fafb;border:1px solid #e5e7eb;font-family:monospace;font-weight:700">${orgCode}</td></tr>
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
      const { organizationName, email, tier, referralCode } = signupSchema.parse(req.body);
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
          ? `<tr><td style="padding:8px 12px;font-weight:600;color:#fff;background:#1d6a2e;border:1px solid #166534">🎁 Referral Code</td><td style="padding:8px 12px;background:#dcfce7;border:1px solid #166534;font-weight:700;color:#166534">${validatedReferral.code} — +${validatedReferral.extraMonths} free month${validatedReferral.extraMonths > 1 ? "s" : ""}</td></tr>`
          : referralCode && referralCode.trim()
            ? `<tr><td style="padding:8px 12px;font-weight:600;color:#374151;background:#fff;border:1px solid #e5e7eb">Referral Code</td><td style="padding:8px 12px;background:#fff;border:1px solid #e5e7eb;color:#dc2626">${referralCode.trim()} (invalid)</td></tr>`
            : "";
        const referralText = validatedReferral
          ? `\nReferral Code: ${validatedReferral.code} ✅ (+${validatedReferral.extraMonths} free month${validatedReferral.extraMonths > 1 ? "s" : ""})`
          : referralCode?.trim() ? `\nReferral Code: ${referralCode.trim()} (invalid)` : "";
        const planPrices: Record<string, string> = { small: "$24.99/mo", mid: "$49.99/mo", large: "$74.99/mo", enterprise: "$149.99/mo" };

        sendEmail({
          to: ADMIN_NOTIFY_EMAIL,
          subject: `⭐ FOUNDER PRICING REQUEST – ${config.name} – ${organizationName}${validatedReferral ? " 🎁 Referral" : ""}`,
          html: `<div style="font-family:sans-serif;max-width:520px">
<div style="background:#162A4A;color:#fff;padding:16px 20px;border-radius:8px 8px 0 0">
  <p style="margin:0;font-size:11px;letter-spacing:1px;text-transform:uppercase;opacity:0.7">Better Bucks</p>
  <h2 style="margin:4px 0 0;font-size:20px">⭐ New Founder Pricing Request</h2>
</div>
<div style="background:#f9fafb;padding:20px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px">
  <table style="border-collapse:collapse;width:100%">
    <tr><td style="padding:8px 12px;font-weight:600;color:#374151;background:#fff;border:1px solid #e5e7eb;width:38%">Company</td><td style="padding:8px 12px;background:#fff;border:1px solid #e5e7eb">${organizationName}</td></tr>
    <tr><td style="padding:8px 12px;font-weight:600;color:#374151;background:#f9fafb;border:1px solid #e5e7eb">Contact Email</td><td style="padding:8px 12px;background:#f9fafb;border:1px solid #e5e7eb"><a href="mailto:${email}" style="color:#162A4A">${email}</a></td></tr>
    <tr><td style="padding:8px 12px;font-weight:600;color:#374151;background:#fff;border:1px solid #e5e7eb">Pricing Level</td><td style="padding:8px 12px;background:#fff;border:1px solid #e5e7eb"><strong>FOUNDER PRICING – ${config.name}</strong></td></tr>
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
      });

      // Alert when the 45th company signs up (5 slots left for founder pricing)
      const allOrgs = await storage.getAllOrganizations();
      if (allOrgs.length === 45) {
        sendEmail({
          to: ADMIN_NOTIFY_EMAIL,
          subject: "🚨 Better Bucks: 45 Companies Signed Up – 5 Founder Spots Left!",
          html: `<p>Hi Miles,</p>
<p>The <strong>45th company</strong> just signed up for Better Bucks — only <strong>5 founder pricing spots remain</strong>.</p>
<p><strong>Company:</strong> ${organizationName}<br/><strong>Tier:</strong> ${config.name}<br/><strong>Org Code:</strong> ${orgCode}</p>
<p>Consider promoting the scarcity to drive conversions.</p>
<p>— Better Bucks System</p>`,
          text: `45 companies have signed up. Only 5 founder pricing spots remain. Latest signup: ${organizationName} (${config.name}, code: ${orgCode}).`,
        }).catch(err => console.error("[Email] Failed to send 45-org alert:", err));
      }

      if (isPromoSignup) {
        await storage.updateOrganizationStripe(org.id, "promo_GOKU11", "promo_GOKU11");
        await storage.updateOrganizationStatus(org.id, "active");
        sendSignupNotificationEmail({ organizationName, email, tier, config, orgCode, referralCode, mode: "promo" });
        return res.json({ promoApplied: true, orgCode });
      }

      const stripe = await getStripeClient();

      const customer = await stripe.customers.create({
        email,
        name: organizationName,
        metadata: { organizationId: String(org.id), organizationName, tier },
      });

      const baseUrl = process.env.REPLIT_DEPLOYMENT === '1'
        ? "https://betterbucks.net"
        : `${req.protocol}://${req.get('host')}`;

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
          },
          quantity: 1,
        }],
        mode: 'subscription',
        subscription_data: {
          trial_period_days: trialDays,
          trial_settings: { end_behavior: { missing_payment_method: 'cancel' } },
          metadata: { organizationId: String(org.id), tier, orgCode },
          description: `Better Bucks ${config.name} — ${trialLabel} free trial, then $${(config.price / 100).toFixed(2)}/month.${referralNote}`,
        },
        payment_method_collection: 'always',
        custom_text: {
          submit: {
            message: `Your card won't be charged until after your ${trialLabel} free trial ends.${referralNote}`,
          },
        },
        success_url: `${baseUrl}/login`,
        cancel_url: `${baseUrl}/signup?cancelled=true`,
        metadata: { organizationId: String(org.id), tier, orgCode },
        allow_promotion_codes: false,
        billing_address_collection: 'required',
      });

      await storage.updateOrganizationStripe(org.id, customer.id, "pending_checkout");

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

      const baseUrl = process.env.REPLIT_DEPLOYMENT === '1'
        ? "https://betterbucks.net"
        : `${req.protocol}://${req.get('host')}`;

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
          },
          quantity: 1,
        }],
        mode: 'subscription',
        billing_address_collection: 'required',
        success_url: `${baseUrl}/admin/settings?reactivated=true`,
        cancel_url: `${baseUrl}/reactivate?cancelled=true`,
        metadata: { organizationId: String(org.id), tier, type: "reactivation" },
      });

      await storage.updateOrganizationStripe(org.id, customerId, "pending_checkout");
      await storage.updateOrganizationStatus(org.id, org.status as any);
      await storage.updateOrganizationTier(org.id, tier, config.maxEmployees === -1 ? 999999 : config.maxEmployees);

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

      const user = await storage.createUser({
        username,
        password,
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
        await sendVerificationCode(hasEmail ? email : null, hasPhone ? phone : null, verificationCode!, fullName);
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

  // Get organization info for authenticated prime admin
  app.get("/api/organizations/my-org", async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user || user.role !== "prime_admin") {
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
    if (!user.organizationId) return res.json({ storeEnabled: true, manualOrdersEnabled: true });
    const org = await storage.getOrganization(user.organizationId);
    res.json({ storeEnabled: org?.storeEnabled ?? true, manualOrdersEnabled: org?.manualOrdersEnabled ?? true });
  });

  // Update feature flags (prime admin only)
  app.patch("/api/organizations/feature-flags", async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user || user.role !== "prime_admin") return res.status(401).send("Unauthorized");
    if (!user.organizationId) return res.status(400).json({ message: "No organization" });
    const { storeEnabled, manualOrdersEnabled } = z.object({
      storeEnabled: z.boolean(),
      manualOrdersEnabled: z.boolean(),
    }).parse(req.body);
    const updated = await storage.updateOrganizationFeatureFlags(user.organizationId, storeEnabled, manualOrdersEnabled);
    res.json({ storeEnabled: updated.storeEnabled, manualOrdersEnabled: updated.manualOrdersEnabled });
  });

  // Budget settings - get
  app.get("/api/org/budget-settings", async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user || (user.role !== "admin" && user.role !== "prime_admin")) return res.status(401).send("Unauthorized");
    if (!user.organizationId) return res.status(400).json({ message: "No organization" });
    const org = await storage.getOrganization(user.organizationId);
    res.json({ bucksPerDollar: org?.bucksPerDollar ?? 100, monthlyBudgetBucks: org?.monthlyBudgetBucks ?? 0 });
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
    const updated = await storage.updateOrganizationBudgetSettings(user.organizationId, bucksPerDollar, monthlyBudgetBucks);
    res.json({ bucksPerDollar: updated.bucksPerDollar, monthlyBudgetBucks: updated.monthlyBudgetBucks });
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

  // Leaderboard stats - admins by bucks given, or employees by balance/spent
  app.get("/api/stats/leaderboard", async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user || (user.role !== "admin" && user.role !== "prime_admin")) return res.status(401).send("Unauthorized");
    if (!user.organizationId) return res.status(400).json({ message: "No organization" });
    const mode = (req.query.mode as string) || "admins"; // "admins" | "employees"
    const orgUsers = await storage.getUsersByOrganization(user.organizationId);
    const admins = orgUsers.filter(u => u.role === "admin" || u.role === "prime_admin");
    const employees = orgUsers.filter(u => u.role === "employee");
    if (mode === "admins") {
      if (admins.length === 0) return res.json([]);
      const employeeIds = employees.map(u => u.id);
      if (employeeIds.length === 0) return res.json(admins.map(a => ({ id: a.id, name: a.fullName, bucks: 0 })));
      const rows = await db.select({
        performedBy: transactions.performedBy,
        total: sql<number>`COALESCE(SUM(${transactions.amount}), 0)`,
      }).from(transactions)
        .where(and(inArray(transactions.userId, employeeIds), gt(transactions.amount, 0), inArray(transactions.performedBy, admins.map(a => a.id))))
        .groupBy(transactions.performedBy);
      const byAdmin: Record<number, number> = {};
      for (const r of rows) if (r.performedBy) byAdmin[r.performedBy] = Number(r.total);
      return res.json(admins.map(a => ({ id: a.id, name: a.fullName, bucks: byAdmin[a.id] ?? 0 })).sort((a, b) => b.bucks - a.bucks));
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

  // Cancel subscription (prime admin only)
  app.post("/api/organizations/cancel-subscription", async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user || user.role !== "prime_admin") {
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
      await stripe.subscriptions.cancel(org.stripeSubscriptionId);
      await storage.updateOrganizationStatus(org.id, "paused");
      res.json({ message: "Subscription cancelled successfully" });
    } catch (error) {
      console.error("Error cancelling subscription:", error);
      res.status(500).json({ message: "Failed to cancel subscription" });
    }
  });

  // Stripe billing portal (prime admin only)
  app.post("/api/organizations/billing-portal", async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user || user.role !== "prime_admin") {
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
      const baseUrl = `${req.protocol}://${req.get('host')}`;
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
      } catch (e) {
        console.error("Error checking subscription status:", e);
      }
    }

    const isPaused = org.status === "paused" || org.status === "inactive";
    res.json({ status: org.status, isPaused, orgName: org.name, isPrimeAdmin: user.role === "prime_admin" });
  });

  // Delete organization (prime admin only, free/promo orgs)
  app.post("/api/organizations/delete", async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user || user.role !== "prime_admin") {
      return res.status(401).send("Unauthorized");
    }
    if (!user.organizationId) {
      return res.status(400).json({ message: "No organization found" });
    }

    const org = await storage.getOrganization(user.organizationId);
    if (!org) return res.status(404).json({ message: "Organization not found" });

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

  // Change subscription tier (prime admin only)
  app.post("/api/organizations/change-tier", async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user || user.role !== "prime_admin") {
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
        res.json({ message: "Subscription updated successfully", tier, maxEmployees: config.maxEmployees });
      } else {
        return res.status(400).json({ message: "No active subscription to modify" });
      }
    } catch (error: any) {
      console.error("Error changing tier:", error);
      res.status(500).json({ message: error.message || "Failed to change subscription tier" });
    }
  });

  // Request for Information (RFI) - public endpoint
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
            <p><strong>Name:</strong> ${data.name}</p>
            <p><strong>Email:</strong> ${data.email}</p>
            <p><strong>Phone:</strong> ${data.phone}</p>
            <h3>Employee Incentive Needs:</h3>
            <p>${data.needs.replace(/\n/g, "<br>")}</p>
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
      if (user.emailVerificationCode !== code) {
        return res.status(400).json({ message: "Invalid verification code" });
      }
      const updated = await storage.updateUserEmailVerification(user.id, null, true);
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
    await sendVerificationCode(user.email, user.phone, newCode, user.fullName);
    res.json({ message: "Verification code sent" });
  });

  // ==================== DEVELOPER ROUTES ====================

  app.post("/api/developer-login", async (req, res) => {
    try {
      const { username, password, captchaToken, captchaAnswer } = z.object({
        username: z.string(),
        password: z.string(),
        captchaToken: z.string().optional(),
        captchaAnswer: z.string().optional(),
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
        if (!captchaToken || !captchaAnswer) {
          const challenge = generateCaptchaChallenge();
          return res.status(200).json({ captchaRequired: true, question: challenge.question, token: challenge.token });
        }
        if (!verifyCaptchaToken(captchaToken, captchaAnswer)) {
          const challenge = generateCaptchaChallenge();
          return res.status(200).json({ captchaRequired: true, question: challenge.question, token: challenge.token, error: "Incorrect answer. Please try again." });
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
          primeAdmin: primeAdmin ? { id: primeAdmin.id, username: primeAdmin.username, fullName: primeAdmin.fullName } : null,
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
      const tierPrices: Record<string, number> = { small: 49.99, mid: 99.99, large: 149.99, enterprise: 299.99 };
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

      await storage.updateOrganizationStatus(orgId, "deleted");
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
        await stripe.subscriptions.cancel(org.stripeSubscriptionId);
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

  // Public demo auto-login — no auth required
  app.post("/api/demo/public-login", async (req, res) => {
    try {
      // Self-heal: if the 5s startup delay hasn't passed, seed on demand
      let demoOrg = await storage.getOrganizationByCode("VIEWDEMO");
      if (!demoOrg) {
        await seedDemoOrg();
        demoOrg = await storage.getOrganizationByCode("VIEWDEMO");
      }
      if (!demoOrg) return res.status(503).json({ message: "Demo is starting up, please try again in a moment." });
      const orgUsers = await storage.getUsersByOrganization(demoOrg.id);
      const primeAdmin = orgUsers.find(u => u.role === "prime_admin");
      if (!primeAdmin) return res.status(500).json({ message: "Demo not configured" });
      // Pre-accept terms only if not already set (avoids unnecessary write on repeat logins)
      if (!primeAdmin.termsAcceptedAt) {
        await db.update(users).set({ termsAcceptedAt: new Date() }).where(eq(users.organizationId, demoOrg.id));
      }
      // Reset tutorial so the full interactive tour fires on every new visit
      await db.update(users).set({ tutorialCompleted: false }).where(eq(users.id, primeAdmin.id));
      req.login(primeAdmin, (err) => {
        if (err) return res.status(500).json({ message: "Login failed" });
        (req.session as any).demoOriginalUserId = primeAdmin.id;
        (req.session as any).isPublicDemo = true;
        // Expire demo sessions after 2 hours so they don't accumulate in the DB
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
      req.login(originalUser, (err) => {
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

    req.login(targetUser, (err) => {
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

    // Public demo visitors have no "real" account to return to — just log out completely
    if (isPublicDemo) {
      req.logout((err) => {
        if (err) return res.status(500).json({ message: "Failed to exit demo" });
        req.session.destroy((destroyErr) => {
          if (destroyErr) console.error("Demo session destroy error:", destroyErr);
          res.json({ success: true });
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

  const storeItemSchema = z.object({
    name: z.string().min(1).max(100),
    price: z.coerce.number().int().positive(),
    url: z.string().url(),
    imageUrl: z.string().url(),
  });

  app.post("/api/store-items", async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user || user.role !== "prime_admin") {
      return res.status(401).send("Unauthorized");
    }
    const parsed = storeItemSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0]?.message || "Invalid input" });
    }
    const { name, price, url, imageUrl } = parsed.data;
    const item = await storage.createStoreItem({
      organizationId: user.organizationId!,
      name,
      price,
      url,
      imageUrl,
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

    const parsed = storeItemSchema.partial().safeParse(req.body);
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

    const currentUser = await storage.getUser(user.id);
    if (!currentUser || currentUser.balance < item.price) {
      return res.status(400).json({ message: "Insufficient balance" });
    }

    await storage.updateUserBalance(user.id, -item.price);
    await storage.createTransaction({
      userId: user.id,
      amount: -item.price,
      reason: `Store purchase: ${item.name}`,
      performedBy: user.id,
    });

    let storeConvertedValue: string | null = null;
    if (user.organizationId) {
      const shops = await storage.getShopWebsitesByOrganization(user.organizationId);
      const shop = shops.find(s => s.pointsPerDollar > 0);
      if (shop) {
        const dollars = (item.price / shop.pointsPerDollar).toFixed(2);
        storeConvertedValue = `$${dollars} (${shop.pointsPerDollar} bcks = $1)`;
      }
    }

    const order = await storage.createOrder({
      userId: user.id,
      pointsCost: item.price,
      description: `Store Purchase: ${item.name}`,
      photoUrls: [item.imageUrl],
      itemUrl: item.url,
      shopWebsiteId: null,
      convertedValue: storeConvertedValue,
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

  // ========== Tutorial ==========
  app.post("/api/users/complete-tutorial", async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user) return res.status(401).send("Unauthorized");
    // In public demo mode, track completion in the session only — no DB write
    if ((req.session as any)?.isPublicDemo) {
      (req.session as any).demoTutorialCompleted = true;
      return res.json({ ...user, tutorialCompleted: true });
    }
    const updated = await storage.setTutorialCompleted(user.id, true);
    res.json(updated);
  });

  app.post("/api/users/reset-tutorial", async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user) return res.status(401).send("Unauthorized");
    // In public demo mode, track in session only — no DB write
    if ((req.session as any)?.isPublicDemo) {
      (req.session as any).demoTutorialCompleted = false;
      return res.json({ ...user, tutorialCompleted: false });
    }
    const updated = await storage.setTutorialCompleted(user.id, false);
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
    if (user.role === "admin" && target.departmentId !== user.departmentId) {
      return res.status(403).json({ message: "Cannot access users in other departments" });
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
      extraMonths: z.number().int().min(1).max(12).default(1),
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
      extraMonths: z.number().int().min(1).max(12).optional(),
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
    const origin = isProduction ? "https://betterbucks.net" : `${req.protocol}://${req.get("host")}`;
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
    if ((req as any).isPublicDemo) return res.status(403).json({ message: "Demo mode: surveys are read-only." });
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
    if ((req as any).isPublicDemo) return res.status(403).json({ message: "Demo mode: surveys are read-only." });
    const survey = await storage.getSurvey(Number(req.params.id));
    if (!survey || survey.organizationId !== user.organizationId) return res.status(404).json({ message: "Not found" });
    const updated = await storage.updateSurveyStatus(survey.id, req.body.status);
    res.json(updated);
  }));

  // Delete survey (admin only)
  app.delete("/api/admin/surveys/:id", asyncHandler(async (req, res) => {
    const user = req.user as any;
    if (!user || (user.role !== "admin" && user.role !== "prime_admin")) return res.status(403).json({ message: "Forbidden" });
    if ((req as any).isPublicDemo) return res.status(403).json({ message: "Demo mode: surveys are read-only." });
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
    if ((req as any).isPublicDemo) return res.status(403).json({ message: "Demo mode: survey submissions are disabled." });
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

  return httpServer;
}
