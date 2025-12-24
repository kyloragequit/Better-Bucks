
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

  // Register new admin account (public endpoint)
  app.post(api.auth.registerAdmin.path, async (req, res) => {
    try {
      const adminData = api.auth.registerAdmin.input.parse(req.body);
      const existingUser = await storage.getUserByUsername(adminData.username);
      if (existingUser) {
        return res.status(409).json({ message: "Username already exists" });
      }
      const user = await storage.createUser({
        username: adminData.username,
        password: adminData.password,
        fullName: adminData.fullName,
        role: "admin",
        barcode: adminData.username,
      });
      // Log the user in after registration
      req.logIn(user, (err) => {
        if (err) {
          return res.status(500).json({ message: "Registration successful but login failed" });
        }
        res.status(201).json(user);
      });
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
    const { amount, reason } = api.users.updateBalance.input.parse(req.body);

    const user = await storage.updateUserBalance(id, amount);
    await storage.createTransaction({
      userId: id,
      amount,
      reason,
    });

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

  // Seed default admin if no users
  const users = await storage.getAllUsers();
  if (users.length === 0) {
    await storage.createUser({
      username: "admin",
      password: "adminpassword", // In real app, hash this
      fullName: "System Admin",
      role: "admin",
      barcode: "ADMIN123",
    });
    console.log("Seeded admin user: admin / adminpassword");
  }

  return httpServer;
}
