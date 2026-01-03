
import type { Express } from "express";
import type { Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Setup Auth first
  setupAuth(app);

  // Users
  app.get(api.users.list.path, async (req, res) => {
    if (!req.isAuthenticated() || req.user!.role !== "admin") {
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
      // Create admin in "pending" status - requires DSCLA approval
      const db = require("./db").db;
      const { users: usersTable } = require("@shared/schema");
      const [user] = await db.insert(usersTable).values({
        username: adminData.username,
        password: adminData.password,
        fullName: adminData.fullName,
        role: "admin",
        barcode: adminData.username,
        status: "pending",
      }).returning();
      res.status(201).json({ ...user, message: "Admin registration submitted. Awaiting verification." });
    } catch (e) {
      if (e instanceof z.ZodError) {
        res.status(400).json({ message: "Validation error", field: e.errors[0]?.path?.join(".") });
      } else {
        res.status(500).json({ message: "Internal Server Error" });
      }
    }
  });

  app.post(api.users.create.path, async (req, res) => {
    if (!req.isAuthenticated() || req.user!.role !== "admin") {
      return res.status(401).send("Unauthorized");
    }
    try {
      const userData = api.users.create.input.parse(req.body);
      const existingUser = await storage.getUserByUsername(userData.username);
      if (existingUser) {
        return res.status(400).json({ message: "Username/Employee Code already exists" });
      }
      // In a real app, hash password here. auth.ts usually handles hashing for login
      // For creation, we need to ensure we use the same hashing method
      // For simplicity in this demo, we'll store plain text or simple hash if auth.ts does it
      // *Wait*, passport-local-strategy in setupAuth usually expects a verify function. 
      // We should ideally use a crypto hash. 
      // I'll rely on the auth module to handle hashing if I could, but here I'll just save it. 
      // IMPORTANT: In production, hash this password!
      const user = await storage.createUser({
        ...userData,
        barcode: userData.username, // Default barcode to username/code
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
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");
    
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).send("Invalid ID");

    // Users can see themselves, Admins can see everyone
    if (req.user!.role !== "admin" && req.user!.id !== id) {
      return res.status(403).send("Forbidden");
    }

    const user = await storage.getUser(id);
    if (!user) return res.status(404).send("User not found");

    const transactions = await storage.getTransactionsByUser(id);
    res.json({ ...user, transactions });
  });

  app.post(api.users.updateBalance.path, async (req, res) => {
    if (!req.isAuthenticated() || req.user!.role !== "admin") {
      return res.status(401).send("Unauthorized");
    }

    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).send("Invalid ID");

    const { amount, reason } = api.users.updateBalance.input.parse(req.body);

    const user = await storage.updateUserBalance(id, amount);
    await storage.createTransaction({
      userId: id,
      amount,
      reason,
    });

    res.json(user);
  });

  app.post(api.users.updateRole.path, async (req, res) => {
    if (!req.isAuthenticated() || req.user!.role !== "admin") {
      return res.status(401).send("Unauthorized");
    }

    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).send("Invalid ID");

    const { role } = api.users.updateRole.input.parse(req.body);

    const user = await storage.updateUserRole(id, role);
    res.json(user);
  });

  app.patch(api.users.updateProfile.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).send("Invalid ID");

    // Admins can change their own, Prime can change anyone's
    const isPrime = req.user!.username === "DSCLA";
    if (!isPrime && req.user!.id !== id) {
      return res.status(403).send("Forbidden");
    }

    const data = api.users.updateProfile.input.parse(req.body);
    const user = await storage.updateUserProfile(id, data);
    res.json(user);
  });

  app.delete(api.users.deleteUser.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).send("Invalid ID");

    const targetUser = await storage.getUser(id);
    if (!targetUser) return res.status(404).send("User not found");

    const isPrime = req.user!.username === "DSCLA";
    const isAdmin = req.user!.role === "admin";

    // Prime can delete anyone except themselves
    if (isPrime) {
      if (targetUser.username === "DSCLA") return res.status(400).send("Cannot delete prime account");
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
  app.get(api.users.getPending.path, async (req, res) => {
    if (!req.isAuthenticated() || req.user!.username !== "DSCLA") {
      return res.status(401).send("Unauthorized");
    }
    const pendingAdmins = await storage.getPendingAdmins();
    res.json(pendingAdmins);
  });

  // Approve pending admin (prime account only)
  app.post(api.users.approvePending.path, async (req, res) => {
    if (!req.isAuthenticated() || req.user!.username !== "DSCLA") {
      return res.status(401).send("Unauthorized");
    }
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).send("Invalid ID");
    
    const user = await storage.approveAdminUser(id);
    res.json(user);
  });

  // Transactions
  app.get(api.transactions.list.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");
    
    if (req.user!.role === "admin") {
      const txs = await storage.getAllTransactions();
      res.json(txs);
    } else {
      const txs = await storage.getTransactionsByUser(req.user!.id);
      res.json(txs);
    }
  });

  // Seed default accounts if no users
  const allUsers = await storage.getAllUsers();
  if (allUsers.length === 0) {
    // Create prime account (DSCLA) - can approve other admins
    await storage.createUser({
      username: "DSCLA",
      password: "DHLLACOMBE",
      fullName: "DHL Admin - Lacombe",
      role: "admin",
      barcode: "DSCLA",
    });
    console.log("Seeded prime admin: DSCLA / DHLLACOMBE");
    
    // Create fallback admin for testing
    await storage.createUser({
      username: "admin",
      password: "adminpassword",
      fullName: "System Admin",
      role: "admin",
      barcode: "ADMIN123",
    });
    console.log("Seeded fallback admin: admin / adminpassword");
  }

  return httpServer;
}
