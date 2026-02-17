
import type { Express } from "express";
import type { Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import multer from "multer";
import path from "path";
import fs from "fs";

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
    const users = await storage.getAllUsers();
    res.json(users);
  });

  // Register new admin account (public endpoint) - goes into pending queue
  app.post(api.auth.registerAdmin.path, async (req, res) => {
    try {
      const adminData = api.auth.registerAdmin.input.parse(req.body);
      const existingUser = await storage.getUserByUsername(adminData.username);
      if (existingUser) {
        return res.status(409).json({ message: "Username already exists" });
      }
      // Create admin in "pending" status - requires DSLCA approval
      const user = await storage.createUser({
        username: adminData.username,
        password: adminData.password,
        fullName: adminData.fullName,
        role: "admin",
        barcode: adminData.username,
        status: "pending",
      });
      console.log(`New admin registration: ${user.username} (pending)`);
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
      const existingUser = await storage.getUserByUsername(userData.username);
      if (existingUser) {
        return res.status(400).json({ message: "Username/Employee Code already exists" });
      }
      const user = await storage.createUser({
        ...userData,
        barcode: userData.barcode || userData.username,
        status: "approved",
        mustChangePassword: true,
      });
      res.status(201).json(user);
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
      const pendingAdmins = await storage.getPendingAdmins();
      res.json(pendingAdmins);
    } catch (error) {
      console.error("Error fetching pending admins:", error);
      res.status(500).send("Internal Server Error");
    }
  });

  // Approve pending admin (prime account only)
  app.post("/api/users/:id/approve", async (req, res) => {
    const user = req.user as User | undefined;
    if (!req.isAuthenticated() || !user || user.role !== "prime_admin") {
      return res.status(401).send("Unauthorized");
    }
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).send("Invalid ID");
    
    try {
      const user = await storage.approveAdminUser(id);
      res.json(user);
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
      const allOrders = await storage.getAllOrders();
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

  // Seed default accounts if no users
  const allUsers = await storage.getAllUsers();
  if (allUsers.length === 0) {
    // Create prime account (DSLCA) - can approve other admins
    await storage.createUser({
      username: "DSLCA",
      password: "DHLLACOMBE",
      fullName: "DHL Admin - Lacombe",
      role: "prime_admin",
      barcode: "DSLCA",
      status: "approved"
    });
    console.log("Seeded prime admin: DSLCA / DHLLACOMBE");
    
    // Create fallback admin for testing
    await storage.createUser({
      username: "admin",
      password: "adminpassword",
      fullName: "System Admin",
      role: "admin",
      barcode: "ADMIN123",
      status: "approved"
    });
    console.log("Seeded fallback admin: admin / adminpassword");
  }

  return httpServer;
}
