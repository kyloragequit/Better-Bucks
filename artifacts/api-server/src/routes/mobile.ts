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
import { notifyAdminsOfAccountLockout } from "../lib/lockoutNotify";
import { sendEmail } from "../lib/email";
import { buildPassForEmployee, PassConfigError, pushPassUpdateForEmployee } from "../walletPass";
import { buildGoogleWalletSaveUrl, GoogleWalletConfigError, pushGoogleWalletUpdateForEmployee } from "../googleWalletPass";
import type {
  InsertOrganization,
  InsertUser,
  User,
} from "@workspace/db";

interface MobileRequest extends Request {
  mobileUser: User;
}

export { sendExpoPushNotification } from "../lib/pushNotifications";

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
        const { user: updatedUser, justLocked } = await storage.recordFailedLogin(user.id);
        if (justLocked) {
          void notifyAdminsOfAccountLockout(updatedUser);
        }
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

  // Create a new employee account via social sign-in (used when no existing account is found)
  app.post("/api/mobile/auth/social/signup", async (req, res) => {
    let parsed: {
      provider: "google" | "apple";
      identityToken: string;
      orgCode: string;
      fullName: string;
      email: string;
    };
    try {
      parsed = z
        .object({
          provider: z.enum(["google", "apple"]),
          identityToken: z.string().min(1),
          orgCode: z.string().min(1),
          fullName: z.string().min(2),
          email: z.string().email(),
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
      // Reject if this provider sub is already linked (should sign in, not sign up)
      const existingLink = await storage.getSocialLinkByProvider(parsed.provider, providerUserId);
      if (existingLink) {
        res.status(409).json({ message: "This social account is already linked to a Better Bucks account. Please sign in instead." });
        return;
      }

      // Look up the org by code
      const org = await storage.getOrganizationByCode(parsed.orgCode.toUpperCase());
      if (!org) {
        res.status(404).json({ message: "Org code not found. Check the code with your employer and try again." });
        return;
      }

      // The email we use for the new account's record comes from the client
      // form field (editable by the user). The *provider* email (when present)
      // is cryptographically verified and takes priority for any account-matching
      // logic. We never use the client-supplied email to match/link existing accounts
      // because that would allow an attacker with any valid social token to take over
      // an account just by guessing the victim's email.
      const emailToUse = parsed.email;

      // Auto-link: only when the provider returns a verified email AND that email
      // already exists in our DB. This is safe because we verified the provider
      // token above — the provider email is cryptographically trusted.
      if (providerEmail) {
        const existing =
          (await storage.getUserByEmailGlobal(providerEmail)) ??
          (await storage.getUserByUsername(providerEmail));
        if (existing) {
          await storage.createSocialLink({
            userId: existing.id,
            provider: parsed.provider,
            providerUserId,
            email: providerEmail,
          });
          const token = signMobileToken(existing.id);
          res.json({ token, user: safeUser(existing) });
          return;
        }
      }

      // Reject if the client-supplied email is already taken — the user should
      // sign in instead (no account-linking, since we can't verify ownership).
      const emailConflict =
        (await storage.getUserByEmailGlobal(emailToUse)) ??
        (await storage.getUserByUsername(emailToUse));
      if (emailConflict) {
        res.status(409).json({ message: "An account with this email already exists. Please sign in instead." });
        return;
      }

      // Generate a unique barcode for the employee
      const barcode = `BB-${org.code}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;

      // Social-only accounts have no user-known password. We store a random
      // high-entropy hash so password-based auth helpers never encounter null.
      const randomPassword = await hashPassword(crypto.randomBytes(32).toString("hex"));

      const requireApproval = org.requireSocialSignupApproval ?? false;

      const userInsert: InsertUser & {
        status: "active" | "inactive" | "pending" | "paused" | "deleted";
      } = {
        username: emailToUse,
        password: randomPassword,
        role: "employee",
        status: requireApproval ? "pending" : "active",
        barcode,
        fullName: parsed.fullName,
        email: emailToUse,
        organizationId: org.id,
        emailVerified: providerEmail === emailToUse,
        marketingOptIn: false,
        termsAcceptedAt: new Date(),
      };

      const newUser = await storage.createUser(userInsert);

      await storage.createSocialLink({
        userId: newUser.id,
        provider: parsed.provider,
        providerUserId,
        email: providerEmail,
      });

      if (requireApproval) {
        // Notify org admins that a new employee is awaiting approval (fire-and-forget)
        storage.getUsersByOrganization(org.id).then((orgUsers) => {
          const providerLabel = parsed.provider === "apple" ? "Apple" : "Google";
          const adminTitle = "New employee awaiting approval";
          const adminBody = `${parsed.fullName} signed up via ${providerLabel} and needs your approval before they can access Better Bucks.`;
          for (const admin of orgUsers) {
            if (admin.role !== "admin" && admin.role !== "prime_admin") continue;
            if (!admin.expoPushToken) continue;
            sendExpoPushNotification(admin.expoPushToken, adminTitle, adminBody).catch((err) =>
              logger.error({ err }, "[mobile/auth/social/signup] admin approval notification push failed"),
            );
            storage.createNotificationLog({ userId: admin.id, title: adminTitle, body: adminBody }).catch((err) =>
              logger.error({ err }, "[mobile/auth/social/signup] admin approval notification log failed"),
            );
          }
        }).catch((err) => logger.error({ err }, "[mobile/auth/social/signup] failed to notify admins of pending approval"));

        return res.status(201).json({ pendingApproval: true });
      }

      // Welcome notification to the new employee (fire-and-forget)
      // Push token is unlikely to exist immediately at signup, but handled if present.
      if (newUser.expoPushToken) {
        const welcomeTitle = "Welcome to Better Bucks! 🎉";
        const welcomeBody = "Your manager can now start rewarding you. Check out the store when you're ready!";
        sendExpoPushNotification(newUser.expoPushToken, welcomeTitle, welcomeBody).catch((err) =>
          logger.error({ err }, "[mobile/auth/social/signup] welcome push notification failed"),
        );
        storage.createNotificationLog({ userId: newUser.id, title: welcomeTitle, body: welcomeBody }).catch((err) =>
          logger.error({ err }, "[mobile/auth/social/signup] welcome notification log failed"),
        );
      }

      // Notify org admins that a new employee joined via social sign-in (fire-and-forget)
      storage.getUsersByOrganization(org.id).then((orgUsers) => {
        const providerLabel = parsed.provider === "apple" ? "Apple" : "Google";
        const adminTitle = "New employee joined";
        const adminBody = `${parsed.fullName} joined via ${providerLabel} sign-in and is ready to receive Bucks.`;
        for (const admin of orgUsers) {
          if (admin.role !== "admin" && admin.role !== "prime_admin") continue;
          if (!admin.expoPushToken) continue;
          sendExpoPushNotification(admin.expoPushToken, adminTitle, adminBody).catch((err) =>
            logger.error({ err }, "[mobile/auth/social/signup] admin notification push failed"),
          );
          storage.createNotificationLog({ userId: admin.id, title: adminTitle, body: adminBody }).catch((err) =>
            logger.error({ err }, "[mobile/auth/social/signup] admin notification log failed"),
          );
        }
      }).catch((err) => logger.error({ err }, "[mobile/auth/social/signup] failed to notify admins"));

      const token = signMobileToken(newUser.id);
      res.status(201).json({ token, user: safeUser(newUser) });
    } catch (err) {
      logger.error({ err }, "[mobile/auth/social/signup] Signup failed");
      res.status(500).json({ message: "Could not create account. Please try again." });
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

      // Send security notification email (fire-and-forget)
      if (user.email && user.emailVerified) {
        const providerName = parsed.provider === "google" ? "Google" : "Apple";
        const firstName = (user.fullName || "").split(" ")[0] || "there";
        const eventTime = new Date().toLocaleString("en-US", { dateStyle: "long", timeStyle: "short", timeZone: "UTC" }) + " UTC";
        const html = `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f5f7fb;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:520px;margin:24px auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
    <div style="background:#162A4A;color:#fff;padding:18px 22px;font-weight:700;font-size:16px;">Better Bucks</div>
    <div style="padding:24px 22px;color:#111827;">
      <p style="margin:0 0 14px;font-size:15px;">Hi ${firstName},</p>
      <p style="margin:0 0 18px;font-size:15px;">A <strong>${providerName}</strong> account was linked to your Better Bucks account.</p>
      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:14px 16px;margin:0 0 18px;">
        ${providerEmail ? `<div style="font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px;">${providerName} Account</div>
        <div style="font-size:14px;color:#111827;margin-bottom:12px;">${providerEmail}</div>` : ""}
        <div style="font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px;">Date &amp; Time</div>
        <div style="font-size:14px;color:#111827;">${eventTime}</div>
      </div>
      <p style="margin:0 0 18px;font-size:14px;color:#374151;">If you did not make this change, please contact your administrator immediately.</p>
    </div>
    <div style="background:#f9fafb;color:#9CA3AF;padding:12px 22px;text-align:center;font-size:11px;">You're receiving this because you have an account on Better Bucks.</div>
  </div>
</body></html>`;
        sendEmail({ to: user.email, subject: `[Better Bucks] ${providerName} account linked to your profile`, html }).catch((err: unknown) => {
          logger.error({ err }, "[mobile/account/social/link] Failed to send notification email");
        });
      }
    } catch (err) {
      logger.error({ err }, "[mobile/account/social/link]");
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

      // Send security notification email (fire-and-forget)
      if (user.email && user.emailVerified) {
        const providerName = provider === "google" ? "Google" : "Apple";
        const firstName = (user.fullName || "").split(" ")[0] || "there";
        const eventTime = new Date().toLocaleString("en-US", { dateStyle: "long", timeStyle: "short", timeZone: "UTC" }) + " UTC";
        const html = `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f5f7fb;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:520px;margin:24px auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
    <div style="background:#162A4A;color:#fff;padding:18px 22px;font-weight:700;font-size:16px;">Better Bucks</div>
    <div style="padding:24px 22px;color:#111827;">
      <p style="margin:0 0 14px;font-size:15px;">Hi ${firstName},</p>
      <p style="margin:0 0 18px;font-size:15px;">Your <strong>${providerName}</strong> account has been unlinked from your Better Bucks account.</p>
      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:14px 16px;margin:0 0 18px;">
        <div style="font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px;">Date &amp; Time</div>
        <div style="font-size:14px;color:#111827;">${eventTime}</div>
      </div>
      <p style="margin:0 0 18px;font-size:14px;color:#374151;">If you did not make this change, please contact your administrator immediately.</p>
    </div>
    <div style="background:#f9fafb;color:#9CA3AF;padding:12px 22px;text-align:center;font-size:11px;">You're receiving this because you have an account on Better Bucks.</div>
  </div>
</body></html>`;
        sendEmail({ to: user.email, subject: `[Better Bucks] ${providerName} account unlinked from your profile`, html }).catch((err: unknown) => {
          logger.error({ err }, "[mobile/account/social/unlink] Failed to send notification email");
        });
      }
    } catch (err) {
      logger.error({ err }, "[mobile/account/social/unlink]");
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
      const [freshUser, transactions, merchantTxns, goals] = await Promise.all([
        storage.getUser(user.id),
        storage.getTransactionsByUser(user.id),
        storage.getMerchantTransactionsForEmployee(user.id),
        user.organizationId
          ? storage.getGoalsByOrganization(user.organizationId)
          : Promise.resolve([]),
      ]);

      const activeGoals = goals.filter((g) => g.status === "active");

      const ledgerItems = transactions.map((t) => ({
        id: `tx-${t.id}`,
        amount: t.amount ?? 0,
        reason: t.reason ?? ((t.amount ?? 0) >= 0 ? "Bucks awarded" : "Bucks spent"),
        createdAt: t.createdAt,
        performedByName: t.performedByName ?? null,
      }));

      const merchantItems = merchantTxns.map((mt) => ({
        id: `mt-${mt.id}`,
        amount: -(mt.bucksAmount ?? 0),
        reason: mt.merchant?.name ? `Redeemed at ${mt.merchant.name}` : "Merchant redemption",
        createdAt: mt.createdAt,
        performedByName: null,
      }));

      const recentTransactions = [...ledgerItems, ...merchantItems]
        .sort((a, b) => {
          const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return bTime - aTime;
        })
        .slice(0, 15);

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
      logger.error({ err }, "[mobile/dashboard] Failed to load dashboard");
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
        void pushPassUpdateForEmployee(user.id);
        void pushGoogleWalletUpdateForEmployee(user.id);

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
          void pushPassUpdateForEmployee(order.userId);
          void pushGoogleWalletUpdateForEmployee(order.userId);
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

  // ─── Push Token Registration ───────────────────────────────────────────────

  app.post(
    "/api/mobile/push-token",
    mobileAuthMiddleware,
    async (req, res) => {
      const user = (req as MobileRequest).mobileUser;
      const bodySchema = z.object({ token: z.string().min(1).max(500) });
      const parsed = bodySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid push token" });
      }
      try {
        await storage.updateUserPushToken(user.id, parsed.data.token);
        return res.json({ success: true });
      } catch (err) {
        logger.error({ err }, "[mobile/push-token] failed to save push token");
        return res.status(500).json({ message: "Failed to save push token" });
      }
    },
  );

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
        void pushPassUpdateForEmployee(employeeId);
        void pushGoogleWalletUpdateForEmployee(employeeId);

        const updated = await storage.getUser(employeeId);

        if (employee.expoPushToken) {
          const notifTitle = "You just earned Bucks! 🎉";
          const notifBody = `You just earned ${parsed.data.amount} Bucks for "${parsed.data.reason}"`;
          sendExpoPushNotification(employee.expoPushToken, notifTitle, notifBody).catch((err) =>
            logger.error({ err }, "[mobile/reward] push notification failed"),
          );
          storage.createNotificationLog({ userId: employeeId, title: notifTitle, body: notifBody }).catch((err) =>
            logger.error({ err }, "[mobile/reward] notification log failed"),
          );
        }

        return res.json({
          success: true,
          newBalance: updated?.balance ?? 0,
          employee: updated ? safeUser(updated) : null,
        });
      } catch (err) {
        logger.error({ err }, "[mobile/employees/reward] failed to send reward");
        return res.status(500).json({ message: "Failed to send reward" });
      }
    },
  );

  // ─── Notification Log ──────────────────────────────────────────────────────

  app.get("/api/mobile/notifications", mobileAuthMiddleware, async (req, res) => {
    const user = (req as MobileRequest).mobileUser;
    try {
      const logs = await storage.getNotificationLogsByUser(user.id, 100);
      return res.json(logs);
    } catch (err) {
      logger.error({ err }, "[mobile/notifications] failed to fetch notification logs");
      return res.status(500).json({ message: "Failed to fetch notifications" });
    }
  });

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

  app.get("/api/mobile/summary", mobileAuthMiddleware, async (req, res) => {
    const user = (req as MobileRequest).mobileUser;
    try {
      const summary = await storage.getMonthlyBucksSummary(user.id);
      res.json(summary);
    } catch (err) {
      req.log.error({ err }, "Failed to compute monthly summary");
      res.status(500).json({ message: "Failed to load summary" });
    }
  });

  // Recent transactions — merges ledger entries + merchant redemptions, sorted newest-first
  app.get("/api/mobile/transactions", mobileAuthMiddleware, async (req, res) => {
    const user = (req as MobileRequest).mobileUser;
    const limitParam = Number(req.query.limit ?? 30);
    const limit = isNaN(limitParam) || limitParam < 1 ? 30 : Math.min(limitParam, 100);
    const offsetParam = Number(req.query.offset ?? 0);
    const offset = isNaN(offsetParam) || offsetParam < 0 ? 0 : offsetParam;

    try {
      const [ledger, merchantTxns] = await Promise.all([
        storage.getTransactionsByUser(user.id),
        storage.getMerchantTransactionsForEmployee(user.id),
      ]);

      const ledgerItems = ledger.map((t) => ({
        id: `tx-${t.id}`,
        type: (t.amount ?? 0) >= 0 ? "credit" : "debit",
        amount: t.amount ?? 0,
        reason: t.reason ?? (t.amount >= 0 ? "Bucks awarded" : "Bucks spent"),
        performedByName: t.performedByName ?? null,
        createdAt: t.createdAt,
      }));

      const merchantItems = merchantTxns.map((mt) => ({
        id: `mt-${mt.id}`,
        type: "debit" as const,
        amount: -(mt.bucksAmount ?? 0),
        reason: mt.merchant?.name ? `Redeemed at ${mt.merchant.name}` : "Merchant redemption",
        performedByName: null,
        createdAt: mt.createdAt,
      }));

      const sorted = [...ledgerItems, ...merchantItems].sort((a, b) => {
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bTime - aTime;
      });

      const total = sorted.length;
      const transactions = sorted.slice(offset, offset + limit);

      res.json({ transactions, total, offset, limit });
    } catch (err) {
      logger.error({ err }, "[mobile/transactions] Failed to load transactions");
      res.status(500).json({ message: "Could not load transactions" });
    }
  });

  // Merchant transaction detail (user-scoped)
  app.get("/api/mobile/merchant-transactions/:id", mobileAuthMiddleware, async (req, res) => {
    const user = (req as MobileRequest).mobileUser;
    const mtId = Number(req.params.id);
    if (isNaN(mtId) || mtId < 1) {
      return res.status(400).json({ message: "Invalid merchant transaction id" });
    }

    try {
      const all = await storage.getMerchantTransactionsForEmployee(user.id);
      const mt = all.find((t) => t.id === mtId);
      if (!mt) {
        return res.status(404).json({ message: "Merchant transaction not found" });
      }

      res.json({
        id: mt.id,
        amount: -(mt.bucksAmount ?? 0),
        reason: mt.merchant?.name ? `Redeemed at ${mt.merchant.name}` : "Merchant redemption",
        type: "debit" as const,
        createdAt: mt.createdAt,
        performedByName: null,
        merchantName: mt.merchant?.name ?? null,
        categoryId: null,
        categoryName: null,
        categoryColor: null,
      });
    } catch (err) {
      logger.error({ err }, "[mobile/merchant-transactions/:id] Failed to load merchant transaction");
      res.status(500).json({ message: "Could not load transaction" });
    }
  });

  // Single transaction detail — ledger entries only (user-scoped)
  app.get("/api/mobile/transactions/:id", mobileAuthMiddleware, async (req, res) => {
    const user = (req as MobileRequest).mobileUser;
    const txId = Number(req.params.id);
    if (isNaN(txId) || txId < 1) {
      return res.status(400).json({ message: "Invalid transaction id" });
    }

    try {
      const all = await storage.getTransactionsByUser(user.id);
      const tx = all.find((t) => t.id === txId);
      if (!tx) {
        return res.status(404).json({ message: "Transaction not found" });
      }

      let categoryName: string | null = null;
      let categoryColor: string | null = null;
      if (tx.categoryId && user.organizationId) {
        const categories = await storage.getCategoriesByOrg(user.organizationId);
        const cat = categories.find((c) => c.id === tx.categoryId);
        if (cat) {
          categoryName = cat.name;
          categoryColor = cat.color;
        }
      }

      res.json({
        id: tx.id,
        amount: tx.amount,
        reason: tx.reason,
        type: tx.amount >= 0 ? "credit" : "debit",
        createdAt: tx.createdAt,
        performedByName: tx.performedByName ?? null,
        categoryId: tx.categoryId ?? null,
        categoryName,
        categoryColor,
      });
    } catch (err) {
      logger.error({ err }, "[mobile/transactions/:id] Failed to load transaction");
      res.status(500).json({ message: "Could not load transaction" });
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

  // ─── Profile Update ────────────────────────────────────────────────────────

  app.patch("/api/mobile/profile", mobileAuthMiddleware, async (req, res) => {
    const user = (req as MobileRequest).mobileUser;
    const bodySchema = z.object({
      fullName: z.string().min(1).max(100).optional(),
      email: z.string().email().nullable().optional(),
    });
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Invalid input" });
    }
    try {
      const updated = await storage.updateUserProfile(user.id, parsed.data);
      return res.json({ success: true, user: safeUser(updated) });
    } catch (err) {
      logger.error({ err }, "[mobile/profile] update failed");
      return res.status(500).json({ message: "Update failed" });
    }
  });

  // ─── Wishlist ─────────────────────────────────────────────────────────────

  app.get("/api/mobile/wishlist", mobileAuthMiddleware, async (req, res) => {
    const user = (req as MobileRequest).mobileUser;
    try {
      const items = await storage.getWishlistByUser(user.id);
      return res.json(items);
    } catch (err) {
      logger.error({ err }, "[mobile/wishlist] get failed");
      return res.status(500).json({ message: "Failed to load wishlist" });
    }
  });

  app.post("/api/mobile/wishlist/:itemId", mobileAuthMiddleware, async (req, res) => {
    const user = (req as MobileRequest).mobileUser;
    const itemId = parseInt(req.params.itemId);
    if (isNaN(itemId)) return res.status(400).json({ message: "Invalid item ID" });
    try {
      const item = await storage.getStoreItem(itemId);
      if (!item || item.organizationId !== user.organizationId) {
        return res.status(404).json({ message: "Item not found" });
      }
      const entry = await storage.addToWishlist(user.id, itemId);
      return res.json(entry);
    } catch (err: any) {
      if (err?.code === "23505") return res.status(409).json({ message: "Already in wishlist" });
      logger.error({ err }, "[mobile/wishlist] add failed");
      return res.status(500).json({ message: "Failed to add to wishlist" });
    }
  });

  app.delete("/api/mobile/wishlist/:itemId", mobileAuthMiddleware, async (req, res) => {
    const user = (req as MobileRequest).mobileUser;
    const itemId = parseInt(req.params.itemId);
    if (isNaN(itemId)) return res.status(400).json({ message: "Invalid item ID" });
    try {
      await storage.removeFromWishlist(user.id, itemId);
      return res.json({ success: true });
    } catch (err) {
      logger.error({ err }, "[mobile/wishlist] remove failed");
      return res.status(500).json({ message: "Failed to remove from wishlist" });
    }
  });

  // ─── Admin: Employees ─────────────────────────────────────────────────────

  app.get("/api/mobile/admin/employees", mobileAuthMiddleware, async (req, res) => {
    const user = (req as MobileRequest).mobileUser;
    if (!isAdmin(user) || !user.organizationId) {
      return res.status(403).json({ message: "Admins only" });
    }
    try {
      const employees = await storage.getUsersByOrganization(user.organizationId);
      return res.json(employees.map(safeUser));
    } catch (err) {
      logger.error({ err }, "[mobile/admin/employees] list failed");
      return res.status(500).json({ message: "Failed to load employees" });
    }
  });

  app.get("/api/mobile/admin/employees/:id", mobileAuthMiddleware, async (req, res) => {
    const user = (req as MobileRequest).mobileUser;
    if (!isAdmin(user) || !user.organizationId) {
      return res.status(403).json({ message: "Admins only" });
    }
    const empId = parseInt(req.params.id);
    if (isNaN(empId)) return res.status(400).json({ message: "Invalid ID" });
    try {
      const [emp, transactions] = await Promise.all([
        storage.getUser(empId),
        storage.getTransactionsByUser(empId),
      ]);
      if (!emp || emp.organizationId !== user.organizationId) {
        return res.status(404).json({ message: "Employee not found" });
      }
      return res.json({ ...safeUser(emp), transactions: transactions.slice(0, 30) });
    } catch (err) {
      logger.error({ err }, "[mobile/admin/employees/:id] get failed");
      return res.status(500).json({ message: "Failed to load employee" });
    }
  });

  app.patch("/api/mobile/admin/employees/:id", mobileAuthMiddleware, async (req, res) => {
    const user = (req as MobileRequest).mobileUser;
    if (!isAdmin(user) || !user.organizationId) {
      return res.status(403).json({ message: "Admins only" });
    }
    const empId = parseInt(req.params.id);
    if (isNaN(empId)) return res.status(400).json({ message: "Invalid ID" });
    const bodySchema = z.object({
      role: z.enum(["admin", "employee"]).optional(),
      fullName: z.string().min(1).max(100).optional(),
      email: z.string().email().nullable().optional(),
    });
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Invalid input" });
    }
    try {
      const emp = await storage.getUser(empId);
      if (!emp || emp.organizationId !== user.organizationId) {
        return res.status(404).json({ message: "Employee not found" });
      }
      if (emp.role === "prime_admin") {
        return res.status(403).json({ message: "Cannot modify the organization owner" });
      }
      let updated = emp;
      if (parsed.data.role) {
        updated = await storage.updateUserRole(empId, parsed.data.role);
      }
      if (parsed.data.fullName !== undefined || parsed.data.email !== undefined) {
        updated = await storage.updateUserProfile(empId, {
          fullName: parsed.data.fullName,
          email: parsed.data.email,
        });
      }
      return res.json(safeUser(updated));
    } catch (err) {
      logger.error({ err }, "[mobile/admin/employees/:id PATCH] failed");
      return res.status(500).json({ message: "Update failed" });
    }
  });

  app.post("/api/mobile/admin/employees/:id/balance", mobileAuthMiddleware, async (req, res) => {
    const user = (req as MobileRequest).mobileUser;
    if (!isAdmin(user) || !user.organizationId) {
      return res.status(403).json({ message: "Admins only" });
    }
    const empId = parseInt(req.params.id);
    if (isNaN(empId)) return res.status(400).json({ message: "Invalid ID" });
    const bodySchema = z.object({
      amount: z.number().int().refine((n) => n !== 0, { message: "Amount cannot be 0" }),
      reason: z.string().min(1).max(500),
    });
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Invalid input" });
    }
    try {
      const emp = await storage.getUser(empId);
      if (!emp || emp.organizationId !== user.organizationId) {
        return res.status(404).json({ message: "Employee not found" });
      }
      await storage.updateUserBalance(empId, parsed.data.amount);
      await storage.createTransaction({
        userId: empId,
        amount: parsed.data.amount,
        reason: parsed.data.reason,
        performedBy: user.id,
      });
      void pushPassUpdateForEmployee(empId);
      void pushGoogleWalletUpdateForEmployee(empId);
      const fresh = await storage.getUser(empId);
      return res.json({ success: true, newBalance: fresh?.balance ?? 0 });
    } catch (err) {
      logger.error({ err }, "[mobile/admin/employees/:id/balance] failed");
      return res.status(500).json({ message: "Balance update failed" });
    }
  });

  app.delete("/api/mobile/admin/employees/:id", mobileAuthMiddleware, async (req, res) => {
    const user = (req as MobileRequest).mobileUser;
    if (!isAdmin(user) || !user.organizationId) {
      return res.status(403).json({ message: "Admins only" });
    }
    const empId = parseInt(req.params.id);
    if (isNaN(empId)) return res.status(400).json({ message: "Invalid ID" });
    try {
      const emp = await storage.getUser(empId);
      if (!emp || emp.organizationId !== user.organizationId) {
        return res.status(404).json({ message: "Employee not found" });
      }
      if (emp.role === "prime_admin") {
        return res.status(403).json({ message: "Cannot delete the organization owner" });
      }
      await storage.deleteUser(empId);
      return res.json({ success: true });
    } catch (err) {
      logger.error({ err }, "[mobile/admin/employees/:id DELETE] failed");
      return res.status(500).json({ message: "Delete failed" });
    }
  });

  // ─── Admin: Pending Accounts ──────────────────────────────────────────────

  app.get("/api/mobile/admin/pending", mobileAuthMiddleware, async (req, res) => {
    const user = (req as MobileRequest).mobileUser;
    if (!isAdmin(user) || !user.organizationId) {
      return res.status(403).json({ message: "Admins only" });
    }
    try {
      const pending = await storage.getPendingAdminsByOrganization(user.organizationId);
      return res.json(pending.map(safeUser));
    } catch (err) {
      logger.error({ err }, "[mobile/admin/pending] list failed");
      return res.status(500).json({ message: "Failed to load pending accounts" });
    }
  });

  app.post("/api/mobile/admin/pending/:id/approve", mobileAuthMiddleware, async (req, res) => {
    const user = (req as MobileRequest).mobileUser;
    if (!isAdmin(user) || !user.organizationId) {
      return res.status(403).json({ message: "Admins only" });
    }
    const pendingId = parseInt(req.params.id);
    if (isNaN(pendingId)) return res.status(400).json({ message: "Invalid ID" });
    try {
      const pending = await storage.getUser(pendingId);
      if (!pending || pending.organizationId !== user.organizationId) {
        return res.status(404).json({ message: "Account not found" });
      }
      const approved = await storage.approveAdminUser(pendingId);
      return res.json(safeUser(approved));
    } catch (err) {
      logger.error({ err }, "[mobile/admin/pending/:id/approve] failed");
      return res.status(500).json({ message: "Approval failed" });
    }
  });

  app.delete("/api/mobile/admin/pending/:id", mobileAuthMiddleware, async (req, res) => {
    const user = (req as MobileRequest).mobileUser;
    if (!isAdmin(user) || !user.organizationId) {
      return res.status(403).json({ message: "Admins only" });
    }
    const pendingId = parseInt(req.params.id);
    if (isNaN(pendingId)) return res.status(400).json({ message: "Invalid ID" });
    try {
      const pending = await storage.getUser(pendingId);
      if (!pending || pending.organizationId !== user.organizationId) {
        return res.status(404).json({ message: "Account not found" });
      }
      await storage.deleteUser(pendingId);
      return res.json({ success: true });
    } catch (err) {
      logger.error({ err }, "[mobile/admin/pending/:id DELETE] failed");
      return res.status(500).json({ message: "Delete failed" });
    }
  });

  // ─── Admin: Goals ─────────────────────────────────────────────────────────

  app.get("/api/mobile/admin/goals", mobileAuthMiddleware, async (req, res) => {
    const user = (req as MobileRequest).mobileUser;
    if (!isAdmin(user) || !user.organizationId) {
      return res.status(403).json({ message: "Admins only" });
    }
    try {
      const goals = await storage.getGoalsByOrganization(user.organizationId);
      return res.json(goals);
    } catch (err) {
      logger.error({ err }, "[mobile/admin/goals] list failed");
      return res.status(500).json({ message: "Failed to load goals" });
    }
  });

  app.post("/api/mobile/admin/goals", mobileAuthMiddleware, async (req, res) => {
    const user = (req as MobileRequest).mobileUser;
    if (!isAdmin(user) || !user.organizationId) {
      return res.status(403).json({ message: "Admins only" });
    }
    const bodySchema = z.object({
      title: z.string().min(1).max(200),
      type: z.enum(["time", "quantity"]),
      bucksReward: z.number().int().min(1),
      targetQuantity: z.number().int().min(1).optional().nullable(),
      targetDays: z.number().int().min(1).optional().nullable(),
      endDate: z.string().datetime().optional().nullable(),
    });
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Invalid input" });
    }
    try {
      const goal = await storage.createGoal({
        organizationId: user.organizationId,
        title: parsed.data.title,
        type: parsed.data.type,
        bucksReward: parsed.data.bucksReward,
        targetQuantity: parsed.data.targetQuantity ?? null,
        targetDays: parsed.data.targetDays ?? null,
        endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : null,
        createdBy: user.id,
        status: "active",
        startDate: new Date(),
        targetType: "all",
        targetIds: null,
      });
      return res.json(goal);
    } catch (err) {
      logger.error({ err }, "[mobile/admin/goals POST] failed");
      return res.status(500).json({ message: "Failed to create goal" });
    }
  });

  app.patch("/api/mobile/admin/goals/:id", mobileAuthMiddleware, async (req, res) => {
    const user = (req as MobileRequest).mobileUser;
    if (!isAdmin(user) || !user.organizationId) {
      return res.status(403).json({ message: "Admins only" });
    }
    const goalId = parseInt(req.params.id);
    if (isNaN(goalId)) return res.status(400).json({ message: "Invalid ID" });
    const bodySchema = z.object({
      title: z.string().min(1).max(200).optional(),
      bucksReward: z.number().int().min(1).optional(),
      targetQuantity: z.number().int().min(1).nullable().optional(),
      targetDays: z.number().int().min(1).nullable().optional(),
      status: z.enum(["active", "completed", "failed", "pending_distribution"]).optional(),
      endDate: z.string().datetime().nullable().optional(),
    });
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Invalid input" });
    }
    try {
      const goal = await storage.getGoal(goalId);
      if (!goal || goal.organizationId !== user.organizationId) {
        return res.status(404).json({ message: "Goal not found" });
      }
      const updateData: Record<string, unknown> = {};
      if (parsed.data.title !== undefined) updateData.title = parsed.data.title;
      if (parsed.data.bucksReward !== undefined) updateData.bucksReward = parsed.data.bucksReward;
      if (parsed.data.targetQuantity !== undefined) updateData.targetQuantity = parsed.data.targetQuantity;
      if (parsed.data.targetDays !== undefined) updateData.targetDays = parsed.data.targetDays;
      if (parsed.data.status !== undefined) updateData.status = parsed.data.status;
      if (parsed.data.endDate !== undefined) updateData.endDate = parsed.data.endDate ? new Date(parsed.data.endDate) : null;
      const updated = await storage.updateGoal(goalId, updateData as Parameters<typeof storage.updateGoal>[1]);
      return res.json(updated);
    } catch (err) {
      logger.error({ err }, "[mobile/admin/goals/:id PATCH] failed");
      return res.status(500).json({ message: "Update failed" });
    }
  });

  app.delete("/api/mobile/admin/goals/:id", mobileAuthMiddleware, async (req, res) => {
    const user = (req as MobileRequest).mobileUser;
    if (!isAdmin(user) || !user.organizationId) {
      return res.status(403).json({ message: "Admins only" });
    }
    const goalId = parseInt(req.params.id);
    if (isNaN(goalId)) return res.status(400).json({ message: "Invalid ID" });
    try {
      const goal = await storage.getGoal(goalId);
      if (!goal || goal.organizationId !== user.organizationId) {
        return res.status(404).json({ message: "Goal not found" });
      }
      await storage.deleteGoal(goalId);
      return res.json({ success: true });
    } catch (err) {
      logger.error({ err }, "[mobile/admin/goals/:id DELETE] failed");
      return res.status(500).json({ message: "Delete failed" });
    }
  });

  app.post("/api/mobile/admin/goals/:id/increment", mobileAuthMiddleware, async (req, res) => {
    const user = (req as MobileRequest).mobileUser;
    if (!isAdmin(user) || !user.organizationId) {
      return res.status(403).json({ message: "Admins only" });
    }
    const goalId = parseInt(req.params.id);
    if (isNaN(goalId)) return res.status(400).json({ message: "Invalid ID" });
    const bodySchema = z.object({ amount: z.number().int().min(1).default(1) });
    const parsed = bodySchema.safeParse(req.body);
    const amount = parsed.success ? parsed.data.amount : 1;
    try {
      const goal = await storage.getGoal(goalId);
      if (!goal || goal.organizationId !== user.organizationId) {
        return res.status(404).json({ message: "Goal not found" });
      }
      if (goal.type !== "quantity") {
        return res.status(400).json({ message: "Only quantity goals can be incremented" });
      }
      const updated = await storage.incrementGoalQuantity(goalId, amount);
      if (updated.targetQuantity && updated.currentQuantity >= updated.targetQuantity && updated.status === "active") {
        await storage.completeGoal(goalId);
        void storage.distributeGoalBucks(goalId, user.organizationId, user.id).catch(() => {});
      }
      return res.json(updated);
    } catch (err) {
      logger.error({ err }, "[mobile/admin/goals/:id/increment] failed");
      return res.status(500).json({ message: "Increment failed" });
    }
  });

  // ─── Admin: Surveys ───────────────────────────────────────────────────────

  app.get("/api/mobile/admin/surveys", mobileAuthMiddleware, async (req, res) => {
    const user = (req as MobileRequest).mobileUser;
    if (!isAdmin(user) || !user.organizationId) {
      return res.status(403).json({ message: "Admins only" });
    }
    try {
      const surveys = await storage.getSurveysByOrganization(user.organizationId);
      return res.json(surveys);
    } catch (err) {
      logger.error({ err }, "[mobile/admin/surveys] list failed");
      return res.status(500).json({ message: "Failed to load surveys" });
    }
  });

  app.post("/api/mobile/admin/surveys", mobileAuthMiddleware, async (req, res) => {
    const user = (req as MobileRequest).mobileUser;
    if (!isAdmin(user) || !user.organizationId) {
      return res.status(403).json({ message: "Admins only" });
    }
    const questionSchema = z.object({
      questionText: z.string().min(1).max(500),
      questionType: z.enum(["multiple_choice", "written"]),
      options: z.array(z.string().min(1)).optional().nullable(),
      orderIndex: z.number().int().default(0),
    });
    const bodySchema = z.object({
      title: z.string().min(1).max(200),
      description: z.string().max(1000).optional().nullable(),
      questions: z.array(questionSchema).min(1),
    });
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Invalid input" });
    }
    try {
      const survey = await storage.createSurvey(
        {
          organizationId: user.organizationId,
          createdBy: user.id,
          title: parsed.data.title,
          description: parsed.data.description ?? null,
          status: "draft",
          linkedGoalId: null,
        },
        parsed.data.questions.map((q, i) => ({
          questionText: q.questionText,
          questionType: q.questionType,
          options: q.options ?? null,
          orderIndex: q.orderIndex ?? i,
        })),
      );
      return res.json(survey);
    } catch (err) {
      logger.error({ err }, "[mobile/admin/surveys POST] failed");
      return res.status(500).json({ message: "Failed to create survey" });
    }
  });

  app.patch("/api/mobile/admin/surveys/:id/status", mobileAuthMiddleware, async (req, res) => {
    const user = (req as MobileRequest).mobileUser;
    if (!isAdmin(user) || !user.organizationId) {
      return res.status(403).json({ message: "Admins only" });
    }
    const surveyId = parseInt(req.params.id);
    if (isNaN(surveyId)) return res.status(400).json({ message: "Invalid ID" });
    const bodySchema = z.object({ status: z.enum(["draft", "active", "closed"]) });
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid status" });
    }
    try {
      const survey = await storage.getSurvey(surveyId);
      if (!survey || survey.organizationId !== user.organizationId) {
        return res.status(404).json({ message: "Survey not found" });
      }
      const updated = await storage.updateSurveyStatus(surveyId, parsed.data.status);
      return res.json(updated);
    } catch (err) {
      logger.error({ err }, "[mobile/admin/surveys/:id/status] failed");
      return res.status(500).json({ message: "Update failed" });
    }
  });

  app.delete("/api/mobile/admin/surveys/:id", mobileAuthMiddleware, async (req, res) => {
    const user = (req as MobileRequest).mobileUser;
    if (!isAdmin(user) || !user.organizationId) {
      return res.status(403).json({ message: "Admins only" });
    }
    const surveyId = parseInt(req.params.id);
    if (isNaN(surveyId)) return res.status(400).json({ message: "Invalid ID" });
    try {
      const survey = await storage.getSurvey(surveyId);
      if (!survey || survey.organizationId !== user.organizationId) {
        return res.status(404).json({ message: "Survey not found" });
      }
      await storage.deleteSurvey(surveyId);
      return res.json({ success: true });
    } catch (err) {
      logger.error({ err }, "[mobile/admin/surveys/:id DELETE] failed");
      return res.status(500).json({ message: "Delete failed" });
    }
  });

  app.get("/api/mobile/admin/surveys/:id/results", mobileAuthMiddleware, async (req, res) => {
    const user = (req as MobileRequest).mobileUser;
    if (!isAdmin(user) || !user.organizationId) {
      return res.status(403).json({ message: "Admins only" });
    }
    const surveyId = parseInt(req.params.id);
    if (isNaN(surveyId)) return res.status(400).json({ message: "Invalid ID" });
    try {
      const survey = await storage.getSurvey(surveyId);
      if (!survey || survey.organizationId !== user.organizationId) {
        return res.status(404).json({ message: "Survey not found" });
      }
      const [results, respondents] = await Promise.all([
        storage.getSurveyResults(surveyId),
        storage.getSurveyRespondents(surveyId),
      ]);
      return res.json({ survey, results, respondents });
    } catch (err) {
      logger.error({ err }, "[mobile/admin/surveys/:id/results] failed");
      return res.status(500).json({ message: "Failed to load results" });
    }
  });

  // ─── Admin: Store Item Management ────────────────────────────────────────

  app.get("/api/mobile/admin/store-items", mobileAuthMiddleware, async (req, res) => {
    const user = (req as MobileRequest).mobileUser;
    if (!isAdmin(user) || !user.organizationId) {
      return res.status(403).json({ message: "Admins only" });
    }
    try {
      const items = await storage.getStoreItemsByOrganization(user.organizationId);
      return res.json(items);
    } catch (err) {
      logger.error({ err }, "[mobile/admin/store-items] list failed");
      return res.status(500).json({ message: "Failed to load store items" });
    }
  });

  app.post("/api/mobile/admin/store-items", mobileAuthMiddleware, async (req, res) => {
    const user = (req as MobileRequest).mobileUser;
    if (!isAdmin(user) || !user.organizationId) {
      return res.status(403).json({ message: "Admins only" });
    }
    const bodySchema = z.object({
      name: z.string().min(1).max(200),
      description: z.string().max(1000).optional().nullable(),
      price: z.number().int().min(1),
      imageUrl: z.string().url().optional().nullable(),
      url: z.string().url().optional().nullable(),
      available: z.boolean().default(true),
      requiresSize: z.boolean().default(false),
      requiresColor: z.boolean().default(false),
      sizes: z.array(z.string()).optional().nullable(),
      colors: z.array(z.string()).optional().nullable(),
    });
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Invalid input" });
    }
    try {
      const item = await storage.createStoreItem({
        organizationId: user.organizationId,
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        price: parsed.data.price,
        imageUrl: parsed.data.imageUrl ?? null,
        url: parsed.data.url ?? null,
        available: parsed.data.available,
        requiresSize: parsed.data.requiresSize,
        requiresColor: parsed.data.requiresColor,
        sizes: parsed.data.sizes ?? null,
        colors: parsed.data.colors ?? null,
      });
      return res.json(item);
    } catch (err) {
      logger.error({ err }, "[mobile/admin/store-items POST] failed");
      return res.status(500).json({ message: "Failed to create item" });
    }
  });

  app.patch("/api/mobile/admin/store-items/:id", mobileAuthMiddleware, async (req, res) => {
    const user = (req as MobileRequest).mobileUser;
    if (!isAdmin(user) || !user.organizationId) {
      return res.status(403).json({ message: "Admins only" });
    }
    const itemId = parseInt(req.params.id);
    if (isNaN(itemId)) return res.status(400).json({ message: "Invalid ID" });
    const bodySchema = z.object({
      name: z.string().min(1).max(200).optional(),
      description: z.string().max(1000).nullable().optional(),
      price: z.number().int().min(1).optional(),
      imageUrl: z.string().url().nullable().optional(),
      url: z.string().url().nullable().optional(),
      available: z.boolean().optional(),
      requiresSize: z.boolean().optional(),
      requiresColor: z.boolean().optional(),
      sizes: z.array(z.string()).nullable().optional(),
      colors: z.array(z.string()).nullable().optional(),
    });
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Invalid input" });
    }
    try {
      const item = await storage.getStoreItem(itemId);
      if (!item || item.organizationId !== user.organizationId) {
        return res.status(404).json({ message: "Item not found" });
      }
      const updated = await storage.updateStoreItem(itemId, parsed.data);
      return res.json(updated);
    } catch (err) {
      logger.error({ err }, "[mobile/admin/store-items/:id PATCH] failed");
      return res.status(500).json({ message: "Update failed" });
    }
  });

  app.delete("/api/mobile/admin/store-items/:id", mobileAuthMiddleware, async (req, res) => {
    const user = (req as MobileRequest).mobileUser;
    if (!isAdmin(user) || !user.organizationId) {
      return res.status(403).json({ message: "Admins only" });
    }
    const itemId = parseInt(req.params.id);
    if (isNaN(itemId)) return res.status(400).json({ message: "Invalid ID" });
    try {
      const item = await storage.getStoreItem(itemId);
      if (!item || item.organizationId !== user.organizationId) {
        return res.status(404).json({ message: "Item not found" });
      }
      await storage.deleteStoreItem(itemId);
      return res.json({ success: true });
    } catch (err) {
      logger.error({ err }, "[mobile/admin/store-items/:id DELETE] failed");
      return res.status(500).json({ message: "Delete failed" });
    }
  });

  // ─── Admin: Org Settings ──────────────────────────────────────────────────

  app.get("/api/mobile/admin/org", mobileAuthMiddleware, async (req, res) => {
    const user = (req as MobileRequest).mobileUser;
    if (!isAdmin(user) || !user.organizationId) {
      return res.status(403).json({ message: "Admins only" });
    }
    try {
      const org = await storage.getOrganization(user.organizationId);
      if (!org) return res.status(404).json({ message: "Organization not found" });
      return res.json(org);
    } catch (err) {
      logger.error({ err }, "[mobile/admin/org] get failed");
      return res.status(500).json({ message: "Failed to load org settings" });
    }
  });

  app.patch("/api/mobile/admin/org/budget", mobileAuthMiddleware, async (req, res) => {
    const user = (req as MobileRequest).mobileUser;
    if (!isAdmin(user) || !user.organizationId) {
      return res.status(403).json({ message: "Admins only" });
    }
    const bodySchema = z.object({
      bucksPerDollar: z.number().int().min(1),
      monthlyBudgetBucks: z.number().int().min(0),
    });
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Invalid input" });
    }
    try {
      const updated = await storage.updateOrganizationBudgetSettings(
        user.organizationId,
        parsed.data.bucksPerDollar,
        parsed.data.monthlyBudgetBucks,
        user.fullName ?? undefined,
      );
      return res.json(updated);
    } catch (err) {
      logger.error({ err }, "[mobile/admin/org/budget] update failed");
      return res.status(500).json({ message: "Update failed" });
    }
  });

  app.patch("/api/mobile/admin/org/labels", mobileAuthMiddleware, async (req, res) => {
    const user = (req as MobileRequest).mobileUser;
    if (!isAdmin(user) || !user.organizationId) {
      return res.status(403).json({ message: "Admins only" });
    }
    const bodySchema = z.object({
      adminLabel: z.string().min(1).max(50),
      employeeLabel: z.string().min(1).max(50),
    });
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Invalid input" });
    }
    try {
      const updated = await storage.updateOrganizationRoleLabels(
        user.organizationId,
        parsed.data.adminLabel,
        parsed.data.employeeLabel,
      );
      return res.json(updated);
    } catch (err) {
      logger.error({ err }, "[mobile/admin/org/labels] update failed");
      return res.status(500).json({ message: "Update failed" });
    }
  });

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
