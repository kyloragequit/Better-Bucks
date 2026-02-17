
import type { Express } from "express";
import type { Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { getUncachableStripeClient, getStripePublishableKey } from "./stripeClient";
import { sql, eq } from "drizzle-orm";
import { db } from "./db";
import { organizations, users } from "@shared/schema";

import type { User } from "@shared/schema";

const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${path.extname(file.originalname)}`),
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp|pdf/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    cb(null, ext && mime);
  },
});

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
    const users = await storage.getUsersByOrganization(user.organizationId);
    res.json(users);
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
      const user = await storage.createUser({
        username: adminData.username,
        password: adminData.password,
        fullName: adminData.fullName,
        role: "admin",
        barcode: adminData.username,
        status: "pending",
        organizationId: org.id,
      });
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

  app.post(api.users.create.path, async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user || (user.role !== "admin" && user.role !== "prime_admin")) {
      return res.status(401).send("Unauthorized");
    }
    try {
      const userData = api.users.create.input.parse(req.body);
      if (user.organizationId) {
        const existingUser = await storage.getUserByUsernameAndOrg(userData.username, user.organizationId);
        if (existingUser) {
          return res.status(400).json({ message: "Username/Employee Code already exists in this organization" });
        }
      }
      const newUser = await storage.createUser({
        ...userData,
        barcode: userData.barcode || userData.username,
        status: "approved",
        mustChangePassword: true,
        organizationId: user.organizationId,
      });
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

    // Users can see themselves, Admins can see everyone
    if (user.role !== "admin" && user.role !== "prime_admin" && user.id !== id) {
      return res.status(403).send("Forbidden");
    }

    const userResult = await storage.getUser(id);
    if (!userResult) return res.status(404).send("User not found");

    const transactions = await storage.getTransactionsByUser(id);
    res.json({ ...userResult, transactions });
  });

  app.post(api.users.updateBalance.path, async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user || (user.role !== "admin" && user.role !== "prime_admin")) {
      return res.status(401).send("Unauthorized");
    }

    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).send("Invalid ID");

    const { amount, reason } = api.users.updateBalance.input.parse(req.body);

    // If not prime admin, deduct from current admin balance
    if (user.role !== "prime_admin") {
      // For credits (giving points)
      if (amount > 0) {
        if (user.balance < amount) {
          return res.status(400).json({ message: "Insufficient balance to award points" });
        }
        // Deduct from admin
        await storage.updateUserBalance(user.id, -amount);
      }
    }

    const updatedUser = await storage.updateUserBalance(id, amount);
    await storage.createTransaction({
      userId: id,
      amount,
      reason,
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

    // Admins can change their own, Prime can change anyone's
    const isPrime = user.role === "prime_admin";
    if (!isPrime && user.id !== id) {
      return res.status(403).send("Forbidden");
    }

    const data = api.users.updateProfile.input.parse(req.body);
    const updatedUser = await storage.updateUserProfile(id, data);
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
  }, upload.array("photos", 10), (req, res) => {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) return res.status(400).json({ message: "No files uploaded" });
    const urls = files.map(f => `/uploads/${f.filename}`);
    res.json({ urls });
  });

  // Orders
  const createOrderSchema = z.object({
    description: z.string().min(1, "Description is required"),
    photoUrls: z.array(z.string()).min(1, "At least one photo is required"),
    pointsCost: z.number().int().positive("Points must be greater than 0"),
  });

  app.post("/api/orders", async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user) return res.status(401).send("Unauthorized");
    if (user.role !== "employee") return res.status(403).json({ message: "Only employees can place orders" });

    try {
      const parsed = createOrderSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0].message });
      const { description, photoUrls, pointsCost } = parsed.data;

      if (user.balance < pointsCost) {
        return res.status(400).json({ message: "Insufficient points balance" });
      }

      const order = await storage.createOrder({
        userId: user.id,
        pointsCost,
        description,
        photoUrls,
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
        reason: `Order #${order.id} rejected - points refunded`,
      });
    }

    const updated = await storage.updateOrderStatus(id, status, adminNotes);
    res.json(updated);
  });

  // Stripe publishable key (public)
  app.get("/api/stripe/publishable-key", async (_req, res) => {
    try {
      const key = await getStripePublishableKey();
      res.json({ publishableKey: key });
    } catch (error) {
      console.error("Error getting Stripe key:", error);
      res.status(500).json({ message: "Could not load payment configuration" });
    }
  });

  // Organization signup - create checkout session
  const signupSchema = z.object({
    organizationName: z.string().min(2, "Organization name is required"),
    email: z.string().email("Valid email is required"),
  });

  app.post("/api/organizations/signup", async (req, res) => {
    try {
      const { organizationName, email } = signupSchema.parse(req.body);
      const stripe = await getUncachableStripeClient();

      const orgCode = crypto.randomBytes(4).toString("hex").toUpperCase();

      const org = await storage.createOrganization({
        name: organizationName,
        code: orgCode,
      });

      const customer = await stripe.customers.create({
        email,
        metadata: { organizationId: String(org.id), organizationName },
      });

      const pricesResult = await db.execute(
        sql`SELECT id FROM stripe.prices WHERE active = true AND recurring IS NOT NULL ORDER BY unit_amount ASC LIMIT 1`
      );

      let priceId: string;
      if (pricesResult.rows.length > 0) {
        priceId = pricesResult.rows[0].id as string;
      } else {
        const allPrices = await stripe.prices.list({ active: true, type: 'recurring', limit: 1 });
        if (allPrices.data.length === 0) {
          return res.status(500).json({ message: "No subscription price configured" });
        }
        priceId = allPrices.data[0].id;
      }

      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const session = await stripe.checkout.sessions.create({
        customer: customer.id,
        payment_method_types: ['card'],
        line_items: [{ price: priceId, quantity: 1 }],
        mode: 'subscription',
        success_url: `${baseUrl}/signup/success?org_code=${orgCode}`,
        cancel_url: `${baseUrl}/signup?cancelled=true`,
        metadata: { organizationId: String(org.id) },
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
  });

  app.post("/api/organizations/setup-prime", async (req, res) => {
    try {
      const { orgCode, username, password, fullName } = setupPrimeSchema.parse(req.body);

      const org = await storage.getOrganizationByCode(orgCode.toUpperCase());
      if (!org) return res.status(404).json({ message: "Invalid organization code" });
      if (org.status !== "active") return res.status(400).json({ message: "Organization subscription is not active yet" });

      const existingUsers = await storage.getAllUsers();
      const orgUsers = existingUsers.filter(u => u.organizationId === org.id);
      const hasPrime = orgUsers.some(u => u.role === "prime_admin");
      if (hasPrime) return res.status(400).json({ message: "This organization already has an administrator set up. Please use the regular login." });

      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) return res.status(409).json({ message: "Username already taken" });

      const user = await storage.createUser({
        username,
        password,
        fullName,
        role: "prime_admin",
        barcode: username,
        status: "approved",
        organizationId: org.id,
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

  // Handle Stripe checkout completion webhook events for org activation
  app.post("/api/organizations/activate", async (req, res) => {
    const { orgCode } = req.body;
    if (!orgCode) return res.status(400).json({ message: "Missing org code" });
    const org = await storage.getOrganizationByCode(orgCode);
    if (!org) return res.status(404).json({ message: "Organization not found" });
    await storage.updateOrganizationStatus(org.id, "active");
    res.json({ success: true });
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
        const stripe = await getUncachableStripeClient();
        const subscriptions = await stripe.subscriptions.list({
          customer: org.stripeCustomerId,
          status: 'active',
          limit: 1,
        });
        if (subscriptions.data.length > 0) {
          await storage.updateOrganizationStripe(org.id, org.stripeCustomerId, subscriptions.data[0].id);
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
    
    const isFree = org.stripeCustomerId === "free_membership";
    res.json({ ...org, isFree });
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

    if (!org.stripeSubscriptionId || org.stripeSubscriptionId === "pending_checkout") {
      return res.status(400).json({ message: "No active subscription to cancel" });
    }

    try {
      const stripe = await getUncachableStripeClient();
      await stripe.subscriptions.cancel(org.stripeSubscriptionId);
      await storage.updateOrganizationStatus(org.id, "inactive");
      res.json({ message: "Subscription cancelled successfully" });
    } catch (error) {
      console.error("Error cancelling subscription:", error);
      res.status(500).json({ message: "Failed to cancel subscription" });
    }
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
