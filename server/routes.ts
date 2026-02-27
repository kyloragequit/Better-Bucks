
import type { Express, Request, Response, NextFunction } from "express";
import type { Server } from "http";
import { setupAuth } from "./auth";
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

async function sendVerificationEmail(email: string, code: string, fullName: string): Promise<void> {
  try {
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    if (!smtpUser || !smtpPass) {
      console.log(`[Email Verification] SMTP not configured. Code for ${email}: ${code}`);
      return;
    }
    const nm = await import("nodemailer");
    const transporter = nm.default.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      auth: { user: smtpUser, pass: smtpPass },
    });
    await transporter.sendMail({
      from: `"Better Bucks" <${smtpUser}>`,
      to: email,
      subject: "Verify your email - Better Bucks",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #d946a8;">Better Bucks</h2>
          <p>Hi ${fullName},</p>
          <p>Your verification code is:</p>
          <div style="background: #fce4ec; padding: 16px; border-radius: 8px; text-align: center; font-size: 32px; letter-spacing: 6px; font-weight: bold; color: #d946a8;">${code}</div>
          <p style="margin-top: 16px; color: #666;">Enter this code in the app to verify your email address.</p>
        </div>
      `,
    });
    console.log(`[Email Verification] Sent to ${email}`);
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

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Setup Auth first
  setupAuth(app);

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
        password: adminData.password,
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
        password: empData.password,
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
      const hasPhone = empPhone && empPhone.length >= 10;
      if (!hasEmail && !hasPhone) {
        return res.status(400).json({ message: "Please provide either a valid email address or phone number" });
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
            const tierNames: Record<string, string> = { small: "Small Site (100)", mid: "Mid-Size Site (300)", large: "Large Site (500)", enterprise: "Enterprise (Unlimited)" };
            return res.status(400).json({ message: `Employee limit reached for your ${tierNames[org.tier] || org.tier} plan (${org.maxEmployees} max). Please upgrade your plan to add more team members.` });
          }
        }
      }

      const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

      const newUser = await storage.createUser({
        ...userData,
        barcode: userData.barcode || userData.username,
        email: hasEmail ? empEmail : null,
        phone: hasPhone ? empPhone : null,
        emailVerificationCode: verificationCode,
        status: "approved",
        mustChangePassword: true,
        organizationId: user.organizationId,
      });

      await sendVerificationCode(hasEmail ? empEmail : null, hasPhone ? empPhone : null, verificationCode, userData.fullName);

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

  // Serve uploaded files
  app.use("/uploads", (req, res, next) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user) return res.status(401).send("Unauthorized");
    next();
  }, (await import("express")).default.static(uploadDir));

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

    const [weekCredit] = await db.select({
      total: sql<number>`COALESCE(SUM(${transactions.amount}), 0)`
    }).from(transactions)
      .where(and(
        inArray(transactions.userId, employeeIds),
        gt(transactions.amount, 0),
        performedByFilter,
        gte(transactions.createdAt, weekAgo)
      ));

    const [monthCredit] = await db.select({
      total: sql<number>`COALESCE(SUM(${transactions.amount}), 0)`
    }).from(transactions)
      .where(and(
        inArray(transactions.userId, employeeIds),
        gt(transactions.amount, 0),
        performedByFilter,
        gte(transactions.createdAt, monthAgo)
      ));

    const [yearCredit] = await db.select({
      total: sql<number>`COALESCE(SUM(${transactions.amount}), 0)`
    }).from(transactions)
      .where(and(
        inArray(transactions.userId, employeeIds),
        gt(transactions.amount, 0),
        performedByFilter,
        gte(transactions.createdAt, yearAgo)
      ));

    const [weekDebit] = await db.select({
      total: sql<number>`COALESCE(SUM(ABS(${transactions.amount})), 0)`
    }).from(transactions)
      .where(and(
        inArray(transactions.userId, employeeIds),
        lt(transactions.amount, 0),
        gte(transactions.createdAt, weekAgo)
      ));

    const [monthDebit] = await db.select({
      total: sql<number>`COALESCE(SUM(ABS(${transactions.amount})), 0)`
    }).from(transactions)
      .where(and(
        inArray(transactions.userId, employeeIds),
        lt(transactions.amount, 0),
        gte(transactions.createdAt, monthAgo)
      ));

    const [yearDebit] = await db.select({
      total: sql<number>`COALESCE(SUM(ABS(${transactions.amount})), 0)`
    }).from(transactions)
      .where(and(
        inArray(transactions.userId, employeeIds),
        lt(transactions.amount, 0),
        gte(transactions.createdAt, yearAgo)
      ));

    res.json({
      week: Number(weekCredit.total),
      month: Number(monthCredit.total),
      year: Number(yearCredit.total),
      weekDebited: Number(weekDebit.total),
      monthDebited: Number(monthDebit.total),
      yearDebited: Number(yearDebit.total),
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

    const orgUsers = await storage.getUsersByOrganization(user.organizationId);
    const admins = orgUsers
      .filter(u => u.role === "admin" || u.role === "prime_admin")
      .map(u => ({ id: u.id, fullName: u.fullName, role: u.role }));

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
    small: { price: 4999, maxEmployees: 100, name: "Small Site" },
    mid: { price: 9999, maxEmployees: 300, name: "Mid-Size Site" },
    large: { price: 14999, maxEmployees: 500, name: "Large Site" },
    enterprise: { price: 29999, maxEmployees: -1, name: "Enterprise Site" },
  } as const;

  // Organization signup - create checkout session
  const signupSchema = z.object({
    organizationName: z.string().min(2, "Organization name is required"),
    email: z.string().email("Valid email is required"),
    tier: z.enum(["small", "mid", "large", "enterprise"]),
    promoCode: z.string().optional(),
  });

  app.post("/api/organizations/signup", async (req, res) => {
    try {
      const { organizationName, email, tier, promoCode } = signupSchema.parse(req.body);
      const config = tierConfig[tier];

      const orgCode = crypto.randomBytes(4).toString("hex").toUpperCase();

      const org = await storage.createOrganization({
        name: organizationName,
        code: orgCode,
        tier,
        maxEmployees: config.maxEmployees,
      });

      if (promoCode && promoCode.toUpperCase() === "GOKU11") {
        await storage.updateOrganizationStripe(org.id, "promo_GOKU11", "promo_GOKU11");
        await storage.updateOrganizationStatus(org.id, "active");

        return res.json({ promoApplied: true, orgCode });
      }

      await ensureStripeReady();
      const stripe = await getStripeClient();

      const customer = await stripe.customers.create({
        email,
        metadata: { organizationId: String(org.id), organizationName, tier },
      });

      const price = await stripe.prices.create({
        unit_amount: config.price,
        currency: "usd",
        recurring: { interval: "month" },
        product_data: {
          name: `Better Bucks - ${config.name}`,
          metadata: { tier },
        },
      });

      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const session = await stripe.checkout.sessions.create({
        customer: customer.id,
        payment_method_types: ['card'],
        line_items: [{ price: price.id, quantity: 1 }],
        mode: 'subscription',
        subscription_data: { trial_period_days: 60 },
        success_url: `${baseUrl}/signup/success?org_code=${orgCode}`,
        cancel_url: `${baseUrl}/signup?cancelled=true`,
        metadata: { organizationId: String(org.id), tier },
      });

      await storage.updateOrganizationStripe(org.id, customer.id, "pending_checkout");

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
          metadata: { organizationId: String(org.id), organizationName: org.name, tier },
        });
        customerId = customer.id;
      }

      const price = await stripe.prices.create({
        unit_amount: config.price,
        currency: "usd",
        recurring: { interval: "month" },
        product_data: {
          name: `Better Bucks Reactivation - ${config.name}`,
          metadata: { tier, type: "reactivation" },
        },
      });

      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ['card'],
        line_items: [{ price: price.id, quantity: 1 }],
        mode: 'subscription',
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
        const existingEmail = await storage.getUserByEmailAndOrg(email, org.id);
        if (existingEmail) return res.status(400).json({ message: "This email is already in use within this organization" });
      }
      if (hasPhone) {
        const existingPhone = await storage.getUserByPhoneAndOrg(phone, org.id);
        if (existingPhone) return res.status(400).json({ message: "This phone number is already in use within this organization" });
      }

      await storage.updateOrganizationStoreUrl(org.id, storeUrl);

      const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

      const user = await storage.createUser({
        username,
        password,
        fullName,
        email: hasEmail ? email : null,
        phone: hasPhone ? phone : null,
        emailVerificationCode: verificationCode,
        role: "prime_admin",
        barcode: username,
        status: "approved",
        organizationId: org.id,
      });

      await sendVerificationCode(hasEmail ? email : null, hasPhone ? phone : null, verificationCode, fullName);

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
      await storage.updateOrganizationStatus(org.id, "inactive");
      return res.json({ message: "Subscription cancelled successfully" });
    }

    if (!org.stripeSubscriptionId || org.stripeSubscriptionId === "pending_checkout") {
      return res.status(400).json({ message: "No active subscription to cancel" });
    }

    try {
      await ensureStripeReady();
      const stripe = await getStripeClient();
      await stripe.subscriptions.cancel(org.stripeSubscriptionId);
      await storage.updateOrganizationStatus(org.id, "inactive");
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
        const subscription = await stripe.subscriptions.retrieve(org.stripeSubscriptionId);
        const price = await stripe.prices.create({
          unit_amount: config.price,
          currency: "usd",
          recurring: { interval: "month" },
          product_data: {
            name: `Better Bucks - ${config.name}`,
            metadata: { tier },
          },
        });

        await stripe.subscriptions.update(org.stripeSubscriptionId, {
          items: [{
            id: subscription.items.data[0].id,
            price: price.id,
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

      const smtpUser = process.env.SMTP_USER;
      const smtpPass = process.env.SMTP_PASS;
      const smtpHost = process.env.SMTP_HOST || "smtp.gmail.com";
      const smtpPort = parseInt(process.env.SMTP_PORT || "587");

      if (smtpUser && smtpPass) {
        const nm = await import("nodemailer");
        const transporter = nm.default.createTransport({
          host: smtpHost,
          port: smtpPort,
          secure: smtpPort === 465,
          auth: { user: smtpUser, pass: smtpPass },
        });

        await transporter.sendMail({
          from: smtpUser,
          to: "miles@betterbucks.net",
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
      const { username, password } = z.object({
        username: z.string(),
        password: z.string(),
      }).parse(req.body);

      const user = await storage.getUserByUsername(username);
      if (!user || user.role !== "developer" || user.password !== password) {
        return res.status(401).json({ message: "Invalid developer credentials" });
      }

      // Check if password needs to be changed (monthly)
      if (user.passwordLastChanged) {
        const daysSinceChange = (Date.now() - new Date(user.passwordLastChanged).getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceChange > 30) {
          await db.update(users).set({ mustChangePassword: true }).where(eq(users.id, user.id));
          user.mustChangePassword = true;
        }
      }

      req.login(user, (err) => {
        if (err) return res.status(500).json({ message: "Login failed" });
        res.json(user);
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

      if (org.status === "active" && org.stripeSubscriptionId !== "pending_checkout") {
        return res.status(400).json({ message: "Cannot delete an active paid organization. Cancel the subscription first." });
      }

      await storage.deleteOrganization(orgId);
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

    const { status } = req.body;
    if (!["active", "paused", "inactive", "pending"].includes(status)) {
      return res.status(400).json({ message: "Invalid status. Must be active, paused, inactive, or pending." });
    }

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

  app.post("/api/store-items", async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user || user.role !== "prime_admin") {
      return res.status(401).send("Unauthorized");
    }
    const { name, price, url, imageUrl } = req.body;
    if (!name || !price || !url || !imageUrl) {
      return res.status(400).json({ message: "name, price, url, and imageUrl are required" });
    }
    const item = await storage.createStoreItem({
      organizationId: user.organizationId!,
      name,
      price: parseInt(price),
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

    const { name, price, url, imageUrl } = req.body;
    const updated = await storage.updateStoreItem(id, {
      ...(name !== undefined && { name }),
      ...(price !== undefined && { price: parseInt(price) }),
      ...(url !== undefined && { url }),
      ...(imageUrl !== undefined && { imageUrl }),
    });
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

    const order = await storage.createOrder({
      userId: user.id,
      pointsCost: item.price,
      description: `Store Purchase: ${item.name}`,
      photoUrls: [item.imageUrl],
      itemUrl: item.url,
      shopWebsiteId: null,
      convertedValue: null,
    });

    res.json(order);
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

    const { name, assignedToUserId, isDisciplinaryAction } = req.body;
    if (!name || !assignedToUserId) {
      return res.status(400).json({ message: "Name and assigned user are required" });
    }

    const assignedUser = await storage.getUser(parseInt(assignedToUserId));
    if (!assignedUser || assignedUser.organizationId !== user.organizationId) {
      return res.status(400).json({ message: "Invalid assigned user" });
    }

    const doc = await storage.createDocument({
      name,
      fileUrl: `/uploads/${req.file.filename}`,
      originalFilename: req.file.originalname,
      assignedToUserId: parseInt(assignedToUserId),
      uploadedByUserId: user.id,
      organizationId: user.organizationId!,
      isDisciplinaryAction: isDisciplinaryAction === "true" || isDisciplinaryAction === true,
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
      password: "Herobrine!10540752",
      fullName: "Developer Admin",
      role: "developer",
      barcode: "DEV001",
      status: "approved",
      emailVerified: true,
      passwordLastChanged: new Date(),
    } as any);
    console.log("Created developer account: MCheezy67");
  } else if (existingDev.role !== "developer" || existingDev.password !== "Herobrine!10540752") {
    await db.update(users).set({ role: "developer", password: "Herobrine!10540752" }).where(eq(users.id, existingDev.id));
    console.log("Updated MCheezy67 developer account");
  }

  // Seed default accounts if no users
  const allUsers = await storage.getAllUsers();
  if (allUsers.length === 0) {
    await storage.createUser({
      username: "DSCLA",
      password: "DHLLACOMBE",
      fullName: "DHL Admin - Lacombe",
      role: "prime_admin",
      barcode: "DSCLA",
      status: "approved",
      organizationId: prime1Org.id,
    });
    console.log("Seeded prime admin: DSCLA / DHLLACOMBE (PRIME1 org)");
    
    await storage.createUser({
      username: "admin",
      password: "adminpassword",
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
