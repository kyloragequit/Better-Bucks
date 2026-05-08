import { Express, Request, Response, NextFunction } from "express";
import crypto from "crypto";
import type Stripe from "stripe";
import { z } from "zod/v4";
import { storage } from "../storage";
import { hashPassword, verifyPassword } from "../auth";
import { ensureStripeReady } from "../stripeLazy";
import { getUncachableStripeClient } from "../stripeClient";
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

      const match = await verifyPassword(password, user.password);
      if (!match) {
        res
          .status(401)
          .json({ message: "Incorrect username or password" });
        return;
      }

      const token = signMobileToken(user.id);
      res.json({ token, user: safeUser(user) });
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

  // Token refresh — issues a fresh 30-day token for an authenticated session.
  // Clients should call this when the token is within ~7 days of expiry.
  app.post("/api/mobile/token/refresh", mobileAuthMiddleware, (req, res) => {
    const user = (req as MobileRequest).mobileUser;
    const token = signMobileToken(user.id);
    res.json({ token, user: safeUser(user) });
  });

  // Account deletion — required by Apple App Store guideline 5.1.1(v)
  app.post(
    "/api/mobile/account/delete",
    mobileAuthMiddleware,
    async (req, res) => {
      const user = (req as MobileRequest).mobileUser;
      try {
        // If this user is the prime admin of an org, also cancel the org's
        // Stripe subscription and mark the org deleted.
        if (user.role === "prime_admin" && user.organizationId) {
          const org = await storage.getOrganization(user.organizationId);
          if (org?.stripeSubscriptionId &&
              !org.stripeSubscriptionId.startsWith("promo_") &&
              !org.stripeSubscriptionId.startsWith("pending_")) {
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
    } = parsed;

    const config = TIER_CONFIG[tier];

    // Enterprise — no payment, just record the lead and return contactPending
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

    // Confirm Stripe is configured
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

    // Reject duplicate username/email upfront
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
      try {
        if (stripeSubscriptionId) {
          await stripe.subscriptions
            .cancel(stripeSubscriptionId)
            .catch(() => undefined);
        }
        if (stripeCustomerId) {
          await stripe.customers
            .del(stripeCustomerId)
            .catch(() => undefined);
        }
      } catch {
        // best-effort rollback; swallow errors
      }
    }

    try {
      // Create customer + attach payment method
      const customer = await stripe.customers.create({
        email,
        name: organizationName,
        payment_method: paymentMethodId,
        invoice_settings: { default_payment_method: paymentMethodId },
        metadata: { source: "mobile_app", tier, organizationName },
      });
      stripeCustomerId = customer.id;

      // Create a Product for this tier (Subscription price_data requires a
      // pre-existing Product ID, not product_data inline).
      const product = await stripe.products.create({
        name: `Better Bucks – ${config.name}`,
        metadata: { tier, source: "mobile_app" },
      });

      // Create subscription with 60-day trial
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

      console.error("[mobile/signup]", err);
      const msg =
        err?.raw?.message ||
        err?.message ||
        "Signup failed. Please try again.";
      res.status(500).json({ message: msg });
    }
  });
}
