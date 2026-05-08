import { Express, Request, Response, NextFunction } from "express";
import crypto from "crypto";
import type Stripe from "stripe";
import { z } from "zod/v4";
import { storage } from "../storage";
import { hashPassword, verifyPassword } from "../auth";
import { ensureStripeReady } from "../stripeLazy";
import { getUncachableStripeClient } from "../stripeClient";
import { logger } from "../lib/logger";
import { sendGhostStripeAlert } from "../lib/alerts";
import { recordStripeOrphan } from "../stripeOrphanRetry";
import { verifyAppleIdentityToken, verifyGoogleIdToken } from "../socialAuth";
import { buildPassForEmployee, PassConfigError } from "../walletPass";
import { buildGoogleWalletSaveUrl, GoogleWalletConfigError } from "../googleWalletPass";
import type {
  InsertOrganization,
  InsertUser,
  User,
} from "@workspace/db";

interface MobileRequest extends Request {
  mobileUser: User;
}

function safeUser(user: User): Omit<User, "password"> {
  const { password: _pw, ...rest } = user;
  return rest;
}

const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function getTokenSecret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) {
    throw new Error(
      "SESSION_SECRET must be set (min 16 chars) for mobile token signing",
    );
  }
  return s;
}

function signMobileToken(userId: number): string {
  const exp = Date.now() + TOKEN_TTL_MS;
  const payload = `${userId}.${exp}`;
  const sig = crypto
    .createHmac("sha256", getTokenSecret())
    .update(payload)
    .digest("base64url");
  return `${Buffer.from(payload).toString("base64url")}.${sig}`;
}

export function verifyMobileToken(token: string): number | null {
  try {
    const [payloadB64, sig] = token.split(".");
    if (!payloadB64 || !sig) return null;
    const payload = Buffer.from(payloadB64, "base64url").toString();
    const expectedSig = crypto
      .createHmac("sha256", getTokenSecret())
      .update(payload)
      .digest("base64url");
    if (
      sig.length !== expectedSig.length ||
      !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))
    ) {
      return null;
    }
    const [userIdStr, expStr] = payload.split(".");
    const userId = Number(userIdStr);
    const exp = Number(expStr);
    if (!userId || !exp || Date.now() > exp) return null;
    return userId;
  } catch {
    return null;
  }
}

export async function mobileAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Missing token" });
  }
  const userId = verifyMobileToken(header.slice(7).trim());
  if (!userId) return res.status(401).json({ message: "Invalid token" });
  const user = await storage.getUser(userId);
  if (!user) return res.status(401).json({ message: "User not found" });
  (req as MobileRequest).mobileUser = user;
  next();
  return;
}

const TIER_CONFIG = {
  small: {
    price: 879,
    maxEmployees: 25,
    name: "A Little Better",
    description: "25 employee logins — 60-day free pilot.",
  },
  mid: {
    price: 1519,
    maxEmployees: 75,
    name: "Much Better",
    description: "75 employee logins — 60-day free pilot.",
  },
  large: {
    price: 2399,
    maxEmployees: 150,
    name: "A LOT Better",
    description: "150 employee logins — 60-day free pilot.",
  },
  enterprise: {
    price: 0,
    maxEmployees: -1,
    name: "How much Better?",
    description: "Unlimited logins — contact us for custom pricing.",
  },
} as const;

const isAdmin = (user: User) =>
  user.role === "admin" || user.role === "prime_admin";

async function verifyHcaptchaToken(token: string): Promise<boolean> {
  const secret = process.env.HCAPTCHA_SECRET;
  if (!secret) {
    return true;
  }
  try {
    const params = new URLSearchParams({ secret, response: token });
    const resp = await fetch("https://api.hcaptcha.com/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
    const data = (await resp.json()) as { success: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}

export function registerMobileRoutes(app: Express) {
  // Public: list pricing tiers
  app.get("/api/mobile/tiers", (_req, res) => {
    res.json(
      Object.entries(TIER_CONFIG).map(([key, val]) => ({
        key,
        name: val.name,
        priceCents: val.price,
        maxEmployees: val.maxEmployees,
        description: val.description,
      })),
    );
  });

  // Login — JSON token instead of cookie session
  app.post("/api/mobile/login", async (req, res) => {
    try {
      const { username, password } = z
        .object({ username: z.string().min(1), password: z.string().min(1) })
        .parse(req.body);

      let user = await storage.getUserByUsername(username);
      if (!user && username.includes("@")) {
        user = await storage.getUserByEmailGlobal(username);
      }
      if (!user) {
        res
          .status(401)
          .json({ message: "Incorrect username or password" });
        return;
      }

      // Check if the account is locked out
      if (user.lockedUntil && new Date() < new Date(user.lockedUntil)) {
        const minutesLeft = Math.ceil(
          (new Date(user.lockedUntil).getTime() - Date.now()) / 60000,
        );
        res.status(429).json({
          message: `Account locked due to too many failed login attempts. Try again in ${minutesLeft} minute${minutesLeft === 1 ? "" : "s"}.`,
        });
        return;
      }

      const match = await verifyPassword(password, user.password);
      if (!match) {
        await storage.recordFailedLogin(user.id);
        res
          .status(401)
          .json({ message: "Incorrect username or password" });
        return;
      }

      const freshUser = await storage.recordSuccessfulLogin(user.id);
      const token = signMobileToken(user.id);
      res.json({ token, user: safeUser(freshUser) });
    } catch (err: any) {
      if (err?.issues) {
        res
          .status(400)
          .json({ message: err.issues[0]?.message ?? "Invalid input" });
        return;
      }
      console.error("[mobile/login]", err);
      res.status(500).json({ message: "Login failed" });
    }
  });

  // Authenticated: current user
  app.get("/api/mobile/me", mobileAuthMiddleware, async (req, res) => {
    const user = (req as MobileRequest).mobileUser;
    res.json(safeUser(user));
  });

  // Change password + update recovery email (auth required)
  app.post(
    "/api/mobile/change-password",
    mobileAuthMiddleware,
    async (req, res) => {
      const user = (req as MobileRequest).mobileUser;
      let parsed: { currentPassword: string; newPassword: string; recoveryEmail: string };
      try {
        parsed = z
          .object({
            currentPassword: z.string().min(1),
            newPassword: z.string().min(6, "New password must be at least 6 characters"),
            recoveryEmail: z.string().email("Recovery email must be a valid email address"),
          })
          .parse(req.body);
      } catch (err: any) {
        res
          .status(400)
          .json({ message: err?.issues?.[0]?.message ?? "Invalid input" });
        return;
      }

      const match = await verifyPassword(parsed.currentPassword, user.password);
      if (!match) {
        res.status(401).json({ message: "Current password is incorrect." });
        return;
      }

      try {
        await storage.updateUserPassword(user.id, parsed.newPassword);
        await storage.updateUserProfile(user.id, {
          email: parsed.recoveryEmail,
        });
        res.json({ message: "Password updated. Recovery email saved." });
      } catch (err) {
        console.error("[mobile/change-password]", err);
        res.status(500).json({ message: "Could not update password. Please try again." });
      }
    },
  );

  // Social sign-in — verifies an Apple or Google identity token and returns a
  // mobile session token. If the provider is already linked to an account the
  // user is signed in; if the verified email matches an existing account it is
  // auto-linked; otherwise a lightweight guest account is provisioned so the
  // employee can be invited into an org later.
  app.post("/api/mobile/auth/social", async (req, res) => {
    let parsed: { provider: "google" | "apple"; identityToken: string };
    try {
      parsed = z
        .object({
          provider: z.enum(["google", "apple"]),
          identityToken: z.string().min(1),
        })
        .parse(req.body);
    } catch (err: any) {
      res.status(400).json({ message: err?.issues?.[0]?.message ?? "Invalid input" });
      return;
    }

    let providerUserId: string;
    let providerEmail: string | null;

    try {
      if (parsed.provider === "apple") {
        const identity = await verifyAppleIdentityToken(parsed.identityToken);
        providerUserId = identity.providerUserId;
        providerEmail = identity.email;
      } else {
        const identity = await verifyGoogleIdToken(parsed.identityToken);
        providerUserId = identity.providerUserId;
        providerEmail = identity.email;
      }
    } catch (err: any) {
      res.status(401).json({ message: err?.message ?? "Identity token verification failed" });
      return;
    }

    try {
      // 1. Check if this provider sub is already linked to a user
      const existingLink = await storage.getSocialLinkByProvider(parsed.provider, providerUserId);
      if (existingLink) {
        const user = await storage.getUser(existingLink.userId);
        if (!user) {
          res.status(401).json({ message: "Linked account not found" });
          return;
        }
        const token = signMobileToken(user.id);
        res.json({ token, user: safeUser(user) });
        return;
      }

      // 2. Try to match by email
      let user = providerEmail ? await storage.getUserByEmailGlobal(providerEmail) : undefined;
      if (!user && providerEmail) {
        user = await storage.getUserByUsername(providerEmail);
      }

      if (user) {
        // Auto-link provider to the matched account
        await storage.createSocialLink({
          userId: user.id,
          provider: parsed.provider,
          providerUserId,
          email: providerEmail,
        });
        const token = signMobileToken(user.id);
        res.json({ token, user: safeUser(user) });
        return;
      }

      // 3. No account found — inform the client so they can sign up or link later
      res.status(404).json({
        message: "No account found for this sign-in. Please create an account or ask your organization admin to invite you.",
        providerEmail,
      });
    } catch (err) {
      console.error("[mobile/auth/social]", err);
      res.status(500).json({ message: "Social sign-in failed" });
    }
  });

  // Link a social provider to the authenticated account
  app.post("/api/mobile/account/social/link", mobileAuthMiddleware, async (req, res) => {
    const user = (req as MobileRequest).mobileUser;
    let parsed: { provider: "google" | "apple"; identityToken: string };
    try {
      parsed = z
        .object({
          provider: z.enum(["google", "apple"]),
          identityToken: z.string().min(1),
        })
        .parse(req.body);
    } catch (err: any) {
      res.status(400).json({ message: err?.issues?.[0]?.message ?? "Invalid input" });
      return;
    }

    let providerUserId: string;
    let providerEmail: string | null;

    try {
      if (parsed.provider === "apple") {
        const identity = await verifyAppleIdentityToken(parsed.identityToken);
        providerUserId = identity.providerUserId;
        providerEmail = identity.email;
      } else {
        const identity = await verifyGoogleIdToken(parsed.identityToken);
        providerUserId = identity.providerUserId;
        providerEmail = identity.email;
      }
    } catch (err: any) {
      res.status(401).json({ message: err?.message ?? "Identity token verification failed" });
      return;
    }

    // Make sure this provider sub isn't already linked to a *different* account
    const existing = await storage.getSocialLinkByProvider(parsed.provider, providerUserId);
    if (existing && existing.userId !== user.id) {
      res.status(409).json({ message: "This account is already linked to a different Better Bucks account." });
      return;
    }

    try {
      await storage.createSocialLink({
        userId: user.id,
        provider: parsed.provider,
        providerUserId,
        email: providerEmail,
      });
      const links = await storage.getSocialLinksByUser(user.id);
      res.json({ success: true, links: links.map((l) => ({ provider: l.provider, email: l.email })) });
    } catch (err) {
      console.error("[mobile/account/social/link]", err);
      res.status(500).json({ message: "Could not link account" });
    }
  });

  // Unlink a social provider from the authenticated account
  app.delete("/api/mobile/account/social/link/:provider", mobileAuthMiddleware, async (req, res) => {
    const user = (req as MobileRequest).mobileUser;
    const provider = req.params["provider"];
    if (provider !== "google" && provider !== "apple") {
      res.status(400).json({ message: "Invalid provider" });
      return;
    }
    try {
      await storage.deleteSocialLink(user.id, provider);
      const links = await storage.getSocialLinksByUser(user.id);
      res.json({ success: true, links: links.map((l) => ({ provider: l.provider, email: l.email })) });
    } catch (err) {
      console.error("[mobile/account/social/unlink]", err);
      res.status(500).json({ message: "Could not unlink account" });
    }
  });

  // List linked social providers for the authenticated account
  app.get("/api/mobile/account/social/links", mobileAuthMiddleware, async (req, res) => {
    const user = (req as MobileRequest).mobileUser;
    try {
      const links = await storage.getSocialLinksByUser(user.id);
      res.json({ links: links.map((l) => ({ provider: l.provider, email: l.email })) });
    } catch (err) {
      console.error("[mobile/account/social/links]", err);
      res.status(500).json({ message: "Could not fetch linked accounts" });
    }
  });

  // Token refresh — issues a fresh 30-day token for an authenticated session.
  // Clients should call this when the token is within ~7 days of expiry.
  app.post("/api/mobile/token/refresh", mobileAuthMiddleware, (req, res) => {
    const user = (req as MobileRequest).mobileUser;
    const token = signMobileToken(user.id);
    res.json({ token, user: safeUser(user) });
  });

  // ─── Dashboard / Home ──────────────────────────────────────────────────────

  // Home screen data: balance, recent transactions, goals summary
  app.get("/api/mobile/dashboard", mobileAuthMiddleware, async (req, res) => {
    const user = (req as MobileRequest).mobileUser;
    try {
      const [freshUser, transactions, goals] = await Promise.all([
        storage.getUser(user.id),
        storage.getTransactionsByUser(user.id),
        user.organizationId
          ? storage.getGoalsByOrganization(user.organizationId)
          : Promise.resolve([]),
      ]);

      const activeGoals = goals.filter((g) => g.status === "active");
      const recentTransactions = transactions.slice(0, 15);

      let adminStats: {
        totalEmployees: number;
        pendingOrdersCount: number;
        totalBucksGiven: number;
      } | null = null;

      if (isAdmin(user) && user.organizationId) {
        const [employees, orgOrders] = await Promise.all([
          storage.getUsersByOrganization(user.organizationId),
          storage.getOrdersByOrganization(user.organizationId),
        ]);
        const pendingOrders = orgOrders.filter((o) => o.status === "pending");
        const totalBucksGiven = transactions
          .filter((t) => t.amount > 0)
          .reduce((sum, t) => sum + t.amount, 0);

        adminStats = {
          totalEmployees: employees.filter((e) => e.role === "employee").length,
          pendingOrdersCount: pendingOrders.length,
          totalBucksGiven,
        };
      }

      res.json({
        balance: freshUser?.balance ?? 0,
        recentTransactions,
        activeGoals,
        adminStats,
      });
    } catch (err) {
      console.error("[mobile/dashboard]", err);
      res.status(500).json({ message: "Failed to load dashboard" });
    }
  });

  // ─── Store ─────────────────────────────────────────────────────────────────

  app.get("/api/mobile/store-items", mobileAuthMiddleware, async (req, res) => {
    const user = (req as MobileRequest).mobileUser;
    if (!user.organizationId) {
      return res.json([]);
    }
    try {
      const items = await storage.getStoreItemsByOrganization(
        user.organizationId,
      );
      return res.json(items.filter((i) => i.available));
    } catch (err) {
      console.error("[mobile/store-items]", err);
      return res.status(500).json({ message: "Failed to load store" });
    }
  });

  app.post(
    "/api/mobile/store-items/:id/purchase",
    mobileAuthMiddleware,
    async (req, res) => {
      const user = (req as MobileRequest).mobileUser;
      if (user.role !== "employee") {
        return res
          .status(403)
          .json({ message: "Only employees can make purchases" });
      }
      const itemId = parseInt(req.params.id);
      if (isNaN(itemId)) return res.status(400).json({ message: "Invalid ID" });

      try {
        const item = await storage.getStoreItem(itemId);
        if (!item || item.organizationId !== user.organizationId) {
          return res.status(404).json({ message: "Item not found" });
        }
        if (!item.available) {
          return res.status(400).json({ message: "Item is not available" });
        }

        const bodySchema = z.object({
          quantity: z.number().int().min(1).max(99).optional().default(1),
          selectedSize: z.string().optional(),
          selectedColor: z.string().optional(),
        });
        const parsed = bodySchema.safeParse(req.body);
        const quantity = parsed.success ? parsed.data.quantity : 1;
        const selectedSize = parsed.success
          ? (parsed.data.selectedSize ?? null)
          : null;
        const selectedColor = parsed.success
          ? (parsed.data.selectedColor ?? null)
          : null;
        const totalCost = item.price * quantity;

        if (item.requiresSize && !selectedSize) {
          return res
            .status(400)
            .json({ message: "Size selection is required for this item." });
        }
        if (item.requiresColor && !selectedColor) {
          return res
            .status(400)
            .json({ message: "Color selection is required for this item." });
        }

        const freshUser = await storage.getUser(user.id);
        if (!freshUser || freshUser.balance < totalCost) {
          return res
            .status(400)
            .json({ message: "Insufficient balance" });
        }

        const reason =
          quantity > 1
            ? `Store purchase: ${item.name} (x${quantity})`
            : `Store purchase: ${item.name}`;

        await storage.updateUserBalance(user.id, -totalCost);
        await storage.createTransaction({
          userId: user.id,
          amount: -totalCost,
          reason,
          performedBy: user.id,
        });

        const order = await storage.createOrder({
          userId: user.id,
          pointsCost: totalCost,
          quantity,
          description:
            quantity > 1
              ? `Store Purchase: ${item.name} (x${quantity})`
              : `Store Purchase: ${item.name}`,
          photoUrls: [item.imageUrl],
          itemUrl: item.url,
          shopWebsiteId: null,
          convertedValue: null,
          selectedSize,
          selectedColor,
        });

        return res.json({ success: true, order, newBalance: freshUser.balance - totalCost });
      } catch (err) {
        console.error("[mobile/purchase]", err);
        return res.status(500).json({ message: "Purchase failed" });
      }
    },
  );

  // ─── Orders ────────────────────────────────────────────────────────────────

  app.get("/api/mobile/orders", mobileAuthMiddleware, async (req, res) => {
    const user = (req as MobileRequest).mobileUser;
    try {
      if (isAdmin(user) && user.organizationId) {
        const orders = await storage.getOrdersByOrganization(
          user.organizationId,
        );
        return res.json(orders);
      }
      const orders = await storage.getOrdersByUser(user.id);
      return res.json(orders);
    } catch (err) {
      console.error("[mobile/orders]", err);
      return res.status(500).json({ message: "Failed to load orders" });
    }
  });

  app.patch(
    "/api/mobile/orders/:id/status",
    mobileAuthMiddleware,
    async (req, res) => {
      const user = (req as MobileRequest).mobileUser;
      if (!isAdmin(user)) {
        return res.status(403).json({ message: "Admins only" });
      }
      const orderId = parseInt(req.params.id);
      if (isNaN(orderId)) {
        return res.status(400).json({ message: "Invalid ID" });
      }
      const bodySchema = z.object({
        status: z.enum(["pending", "approved", "denied", "shipped", "fulfilled"]),
        adminNotes: z.string().optional(),
      });
      const parsed = bodySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid status" });
      }
      try {
        const order = await storage.getOrder(orderId);
        if (!order) return res.status(404).json({ message: "Order not found" });

        const orderUser = await storage.getUser(order.userId);
        if (orderUser?.organizationId !== user.organizationId) {
          return res.status(403).json({ message: "Forbidden" });
        }

        if (parsed.data.status === "denied" && order.status === "pending") {
          await storage.updateUserBalance(order.userId, order.pointsCost);
          await storage.createTransaction({
            userId: order.userId,
            amount: order.pointsCost,
            reason: `Refund: ${order.description ?? "Order denied"}`,
            performedBy: user.id,
          });
        }

        const updated = await storage.updateOrderStatus(
          orderId,
          parsed.data.status,
          parsed.data.adminNotes,
        );
        return res.json(updated);
      } catch (err) {
        console.error("[mobile/orders/status]", err);
        return res.status(500).json({ message: "Failed to update order" });
      }
    },
  );

  // ─── Surveys ───────────────────────────────────────────────────────────────

  app.get("/api/mobile/surveys", mobileAuthMiddleware, async (req, res) => {
    const user = (req as MobileRequest).mobileUser;
    if (!user.organizationId) return res.json([]);
    try {
      const surveys = await storage.getSurveysByOrganization(
        user.organizationId,
      );
      const activeSurveys = isAdmin(user)
        ? surveys
        : surveys.filter((s) => s.status === "active");

      const withResponded = await Promise.all(
        activeSurveys.map(async (s) => {
          const responded = await storage.hasUserRespondedToSurvey(
            s.id,
            user.id,
          );
          return { ...s, responded };
        }),
      );
      return res.json(withResponded);
    } catch (err) {
      console.error("[mobile/surveys]", err);
      return res.status(500).json({ message: "Failed to load surveys" });
    }
  });

  app.get(
    "/api/mobile/surveys/:id",
    mobileAuthMiddleware,
    async (req, res) => {
      const user = (req as MobileRequest).mobileUser;
      const surveyId = parseInt(req.params.id);
      if (isNaN(surveyId)) {
        return res.status(400).json({ message: "Invalid ID" });
      }
      try {
        const survey = await storage.getSurvey(surveyId);
        if (!survey || survey.organizationId !== user.organizationId) {
          return res.status(404).json({ message: "Survey not found" });
        }
        const responded = await storage.hasUserRespondedToSurvey(
          surveyId,
          user.id,
        );
        return res.json({ ...survey, responded });
      } catch (err) {
        console.error("[mobile/surveys/:id]", err);
        return res.status(500).json({ message: "Failed to load survey" });
      }
    },
  );

  app.post(
    "/api/mobile/surveys/:id/respond",
    mobileAuthMiddleware,
    async (req, res) => {
      const user = (req as MobileRequest).mobileUser;
      const surveyId = parseInt(req.params.id);
      if (isNaN(surveyId)) {
        return res.status(400).json({ message: "Invalid ID" });
      }
      try {
        const survey = await storage.getSurvey(surveyId);
        if (!survey || survey.organizationId !== user.organizationId) {
          return res.status(404).json({ message: "Survey not found" });
        }
        if (survey.status !== "active") {
          return res
            .status(400)
            .json({ message: "Survey is not active" });
        }
        const already = await storage.hasUserRespondedToSurvey(
          surveyId,
          user.id,
        );
        if (already) {
          return res
            .status(400)
            .json({ message: "Already responded to this survey" });
        }

        await storage.submitSurveyResponse(
          surveyId,
          user.id,
          req.body.answers || [],
        );

        if ((survey as any).linkedGoalId) {
          try {
            const goal = await storage.getGoal((survey as any).linkedGoalId);
            if (
              goal &&
              goal.type === "quantity" &&
              goal.status === "active" &&
              goal.organizationId === user.organizationId
            ) {
              await storage.incrementGoalQuantity(goal.id, 1);
            }
          } catch {
            // don't block survey submission if goal increment fails
          }
        }

        return res.json({ success: true });
      } catch (err) {
        console.error("[mobile/surveys/respond]", err);
        return res.status(500).json({ message: "Failed to submit response" });
      }
    },
  );

  // ─── Goals ─────────────────────────────────────────────────────────────────

  app.get("/api/mobile/goals", mobileAuthMiddleware, async (req, res) => {
    const user = (req as MobileRequest).mobileUser;
    if (!user.organizationId) return res.json([]);
    try {
      const goals = await storage.getGoalsByOrganization(user.organizationId);
      return res.json(goals.filter((g) => g.status === "active"));
    } catch (err) {
      console.error("[mobile/goals]", err);
      return res.status(500).json({ message: "Failed to load goals" });
    }
  });

  // ─── Admin: Employees & Rewards ────────────────────────────────────────────

  app.get(
    "/api/mobile/employees",
    mobileAuthMiddleware,
    async (req, res) => {
      const user = (req as MobileRequest).mobileUser;
      if (!isAdmin(user)) {
        return res.status(403).json({ message: "Admins only" });
      }
      if (!user.organizationId) return res.json([]);
      try {
        const employees = await storage.getUsersByOrganization(
          user.organizationId,
        );
        return res.json(
          employees
            .filter((e) => e.role === "employee" || e.role === "admin")
            .map(safeUser),
        );
      } catch (err) {
        console.error("[mobile/employees]", err);
        return res.status(500).json({ message: "Failed to load employees" });
      }
    },
  );

  app.post(
    "/api/mobile/employees/:id/reward",
    mobileAuthMiddleware,
    async (req, res) => {
      const admin = (req as MobileRequest).mobileUser;
      if (!isAdmin(admin)) {
        return res.status(403).json({ message: "Admins only" });
      }
      const employeeId = parseInt(req.params.id);
      if (isNaN(employeeId)) {
        return res.status(400).json({ message: "Invalid ID" });
      }

      const bodySchema = z.object({
        amount: z.number().int().min(1).max(100000),
        reason: z.string().min(1).max(500),
      });
      const parsed = bodySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: parsed.error.issues[0]?.message ?? "Invalid input",
        });
      }

      try {
        const employee = await storage.getUser(employeeId);
        if (
          !employee ||
          employee.organizationId !== admin.organizationId
        ) {
          return res.status(404).json({ message: "Employee not found" });
        }

        await storage.updateUserBalance(employeeId, parsed.data.amount);
        await storage.createTransaction({
          userId: employeeId,
          amount: parsed.data.amount,
          reason: parsed.data.reason,
          performedBy: admin.id,
        });

        const updated = await storage.getUser(employeeId);
        return res.json({
          success: true,
          newBalance: updated?.balance ?? 0,
          employee: updated ? safeUser(updated) : null,
        });
      } catch (err) {
        console.error("[mobile/employees/reward]", err);
        return res.status(500).json({ message: "Failed to send reward" });
      }
    },
  );

  // ─── Wallet Pass ───────────────────────────────────────────────────────────

  // iOS: download a .pkpass file that opens in Apple Wallet
  app.get("/api/mobile/wallet-pass", mobileAuthMiddleware, async (req, res) => {
    const user = (req as MobileRequest).mobileUser;
    if (user.role !== "employee") {
      return res.status(403).json({ message: "Only employees can download a wallet pass" });
    }
    try {
      const built = await buildPassForEmployee(user.id, req);
      res.setHeader("Content-Type", "application/vnd.apple.pkpass");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="betterbucks-${user.id}.pkpass"`,
      );
      return res.send(built.buffer);
    } catch (err) {
      if (err instanceof PassConfigError) {
        return res.status(503).json({ message: err.message });
      }
      logger.error({ err }, "[mobile/wallet-pass] Failed to build pass");
      return res.status(500).json({ message: "Could not generate wallet pass. Please try again later." });
    }
  });

  // Android: return a Google Wallet save URL that the client opens via Linking
  app.get("/api/mobile/wallet-pass/android", mobileAuthMiddleware, async (req, res) => {
    const user = (req as MobileRequest).mobileUser;
    if (user.role !== "employee") {
      return res.status(403).json({ message: "Only employees can add a wallet pass" });
    }
    try {
      const saveUrl = await buildGoogleWalletSaveUrl(user.id);
      return res.json({ saveUrl });
    } catch (err) {
      if (err instanceof GoogleWalletConfigError) {
        return res.status(503).json({ message: err.message });
      }
      logger.error({ err }, "[mobile/wallet-pass/android] Failed to build Google Wallet pass");
      return res.status(500).json({ message: "Could not generate wallet pass. Please try again later." });
    }
  });

  // ─── Admin: Stats ──────────────────────────────────────────────────────────

  app.get("/api/mobile/stats", mobileAuthMiddleware, async (req, res) => {
    const user = (req as MobileRequest).mobileUser;
    if (!isAdmin(user)) {
      return res.status(403).json({ message: "Admins only" });
    }
    if (!user.organizationId) {
      return res.json({ totalEmployees: 0, pendingOrders: 0, activeSurveys: 0, activeGoals: 0 });
    }
    try {
      const [employees, orders, surveys, goals] = await Promise.all([
        storage.getUsersByOrganization(user.organizationId),
        storage.getOrdersByOrganization(user.organizationId),
        storage.getSurveysByOrganization(user.organizationId),
        storage.getGoalsByOrganization(user.organizationId),
      ]);

      return res.json({
        totalEmployees: employees.filter(
          (e) => e.role === "employee" || e.role === "admin",
        ).length,
        pendingOrders: orders.filter((o) => o.status === "pending").length,
        activeSurveys: surveys.filter((s) => s.status === "active").length,
        activeGoals: goals.filter((g) => g.status === "active").length,
      });
    } catch (err) {
      console.error("[mobile/stats]", err);
      return res.status(500).json({ message: "Failed to load stats" });
    }
  });

  // ─── Balance & Transactions (granular endpoints) ───────────────────────────

  // Standalone balance — useful for quick targeted refreshes
  app.get("/api/mobile/balance", mobileAuthMiddleware, async (req, res) => {
    const user = (req as MobileRequest).mobileUser;
    res.json({ balance: user.balance ?? 0 });
  });

  // Recent transactions — merges ledger entries + merchant redemptions, sorted newest-first
  app.get("/api/mobile/transactions", mobileAuthMiddleware, async (req, res) => {
    const user = (req as MobileRequest).mobileUser;
    const limitParam = Number(req.query.limit ?? 30);
    const limit = isNaN(limitParam) || limitParam < 1 ? 30 : Math.min(limitParam, 100);

    try {
      const [ledger, merchantTxns] = await Promise.all([
        storage.getTransactionsByUser(user.id),
        storage.getMerchantTransactionsForEmployee(user.id, limit),
      ]);

      const ledgerItems = ledger.slice(0, limit).map((t) => ({
        id: `tx-${t.id}`,
        type: (t.amount ?? 0) >= 0 ? "credit" : "debit",
        amount: t.amount ?? 0,
        reason: t.reason ?? (t.amount >= 0 ? "Bucks awarded" : "Bucks spent"),
        performedByName: t.performedByName ?? null,
        createdAt: t.createdAt,
      }));

      const merchantItems = merchantTxns.slice(0, limit).map((mt) => ({
        id: `mt-${mt.id}`,
        type: "debit" as const,
        amount: -(mt.bucksAmount ?? 0),
        reason: mt.merchant?.name ? `Redeemed at ${mt.merchant.name}` : "Merchant redemption",
        performedByName: null,
        createdAt: mt.createdAt,
      }));

      const combined = [...ledgerItems, ...merchantItems]
        .sort((a, b) => {
          const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return bTime - aTime;
        })
        .slice(0, limit);

      res.json({ transactions: combined });
    } catch (err) {
      console.error("[mobile/transactions]", err);
      res.status(500).json({ message: "Could not load transactions" });
    }
  });

  // ─── Account ───────────────────────────────────────────────────────────────

  // Account deletion — required by Apple App Store guideline 5.1.1(v)
  app.post(
    "/api/mobile/account/delete",
    mobileAuthMiddleware,
    async (req, res) => {
      const user = (req as MobileRequest).mobileUser;
      try {
        if (user.role === "prime_admin" && user.organizationId) {
          const org = await storage.getOrganization(user.organizationId);
          if (
            org?.stripeSubscriptionId &&
            !org.stripeSubscriptionId.startsWith("promo_") &&
            !org.stripeSubscriptionId.startsWith("pending_")
          ) {
            try {
              await ensureStripeReady();
              const stripe = await getUncachableStripeClient();
              await stripe.subscriptions
                .cancel(org.stripeSubscriptionId)
                .catch(() => undefined);
            } catch {
              // Stripe unavailable — proceed with account deletion anyway
            }
          }
          if (org) {
            await storage.updateOrganizationStatus(org.id, "deleted");
          }
        }
        await (
          storage as typeof storage & {
            deleteUser: (id: number) => Promise<void>;
          }
        ).deleteUser(user.id);
        res.json({ success: true });
      } catch (err) {
        console.error("[mobile/account/delete]", err);
        res.status(500).json({ message: "Could not delete account" });
      }
    },
  );

  // ─── Signup ────────────────────────────────────────────────────────────────

  // Signup with Stripe payment method (mobile uses native CardField, not Checkout)
  app.post("/api/mobile/organizations/signup", async (req, res) => {
    const Body = z.object({
      organizationName: z.string().min(2),
      fullName: z.string().min(2),
      email: z.string().email(),
      password: z.string().min(6),
      tier: z.enum(["small", "mid", "large", "enterprise"]),
      paymentMethodId: z.string().min(1).optional(),
      licenseAccepted: z.literal(true),
      hcaptchaToken: z.string().min(1, "hCaptcha verification is required"),
    });
    let parsed: z.infer<typeof Body>;
    try {
      parsed = Body.parse(req.body);
    } catch (err: any) {
      res
        .status(400)
        .json({ message: err?.issues?.[0]?.message ?? "Invalid input" });
      return;
    }
    const {
      organizationName,
      fullName,
      email,
      password,
      tier,
      paymentMethodId,
      licenseAccepted,
      hcaptchaToken,
    } = parsed;

    // Verify hCaptcha token before doing anything else
    const captchaOk = await verifyHcaptchaToken(hcaptchaToken);
    if (!captchaOk) {
      res.status(400).json({ message: "Human verification failed. Please try again." });
      return;
    }

    const config = TIER_CONFIG[tier];

    if (tier === "enterprise") {
      res.json({
        contactPending: true,
        message:
          "Enterprise plans are quoted custom — we'll reach out shortly.",
      });
      return;
    }

    if (!paymentMethodId) {
      res.status(400).json({ message: "Payment method is required" });
      return;
    }

    try {
      await ensureStripeReady();
    } catch {
      res
        .status(503)
        .json({ message: "Payments are temporarily unavailable. Please try again later." });
      return;
    }

    let stripe: Stripe;
    try {
      stripe = await getUncachableStripeClient();
    } catch {
      res
        .status(503)
        .json({ message: "Payments are temporarily unavailable." });
      return;
    }

    const existing =
      (await storage.getUserByUsername(email)) ||
      (await storage.getUserByEmailGlobal(email));
    if (existing) {
      res
        .status(409)
        .json({ message: "An account with this email already exists." });
      return;
    }

    const orgCode = crypto.randomBytes(4).toString("hex").toUpperCase();

    // Track Stripe resources created so we can roll them back on DB failure
    let stripeCustomerId: string | null = null;
    let stripeSubscriptionId: string | null = null;

    async function rollbackStripe() {
      let subCancelError: unknown = null;
      let customerDeleteError: unknown = null;

      if (stripeSubscriptionId) {
        try {
          await stripe.subscriptions.cancel(stripeSubscriptionId);
        } catch (err) {
          subCancelError = err;
        }
      }

      if (stripeCustomerId) {
        try {
          await stripe.customers.del(stripeCustomerId);
        } catch (err) {
          customerDeleteError = err;
        }
      }

      if (subCancelError || customerDeleteError) {
        const lastError = [
          subCancelError instanceof Error ? subCancelError.message : subCancelError ? String(subCancelError) : null,
          customerDeleteError instanceof Error ? customerDeleteError.message : customerDeleteError ? String(customerDeleteError) : null,
        ].filter(Boolean).join("; ");

        logger.error(
          {
            stripeCustomerId,
            stripeSubscriptionId,
            subCancelError,
            customerDeleteError,
          },
          "Stripe rollback failed — persisting orphan for automated retry",
        );
        void sendGhostStripeAlert({
          stripeCustomerId,
          stripeSubscriptionId,
          subCancelError,
          customerDeleteError,
        });

        await recordStripeOrphan({
          stripeCustomerId,
          stripeSubscriptionId,
          lastError,
        });
      }
    }

    try {
      const customer = await stripe.customers.create({
        email,
        name: organizationName,
        payment_method: paymentMethodId,
        invoice_settings: { default_payment_method: paymentMethodId },
        metadata: { source: "mobile_app", tier, organizationName },
      });
      stripeCustomerId = customer.id;

      const product = await stripe.products.create({
        name: `Better Bucks – ${config.name}`,
        metadata: { tier, source: "mobile_app" },
      });

      const subscriptionItem: Stripe.SubscriptionCreateParams.Item = {
        price_data: {
          currency: "usd",
          product: product.id,
          unit_amount: config.price,
          recurring: { interval: "month" },
          tax_behavior: "exclusive",
        },
      };
      const subscriptionParams: Stripe.SubscriptionCreateParams = {
        customer: customer.id,
        items: [subscriptionItem],
        trial_period_days: 60,
        trial_settings: {
          end_behavior: { missing_payment_method: "cancel" },
        },
        default_payment_method: paymentMethodId,
        metadata: { tier, orgCode, source: "mobile_app" },
      };
      const subscription = await stripe.subscriptions.create(
        subscriptionParams,
      );
      stripeSubscriptionId = subscription.id;

      // --- DB writes below: all-or-nothing transaction. Any failure
      //     rolls back every DB row AND triggers Stripe rollback. ---

      const hashed = await hashPassword(password);
      const barcode = `BB-${orgCode}-${crypto
        .randomBytes(3)
        .toString("hex")
        .toUpperCase()}`;

      const orgInsert: InsertOrganization = {
        name: organizationName,
        code: orgCode,
        tier,
        maxEmployees: config.maxEmployees,
        licenseAcceptedAt: licenseAccepted ? new Date() : null,
        marketingOptIn: false,
      };
      // status is omitted from the InsertUser schema (so it defaults to
      // "pending" in normal flows). For mobile signup the prime admin pays
      // upfront, so we mark them "active" by combining the typed insert
      // with the underlying users-table status enum.
      const userInsert: InsertUser & {
        status: "active" | "inactive" | "pending" | "paused" | "deleted";
      } = {
        username: email,
        password: hashed,
        role: "prime_admin",
        status: "active",
        barcode,
        fullName,
        email,
        organizationId: 0, // placeholder; storage sets real org.id inside tx
        emailVerified: false,
        marketingOptIn: false,
        termsAcceptedAt: new Date(),
      };

      const { user } = await storage.createMobileSignup({
        orgInsert,
        stripeCustomerId: customer.id,
        stripeSubscriptionId: subscription.id,
        signupPrice: config.price,
        userInsert,
      });

      const token = signMobileToken(user.id);

      res.json({
        success: true,
        token,
        user: safeUser(user),
        orgCode,
        trialDays: 60,
      });
    } catch (err: any) {
      // Roll back any Stripe objects so the user is not charged and the
      // Stripe account does not accumulate ghost customers/subscriptions.
      await rollbackStripe();

      logger.error({ err }, "[mobile/signup] Signup failed");
      const msg =
        err?.raw?.message ||
        err?.message ||
        "Signup failed. Please try again.";
      res.status(500).json({ message: msg });
    }
  });
}
