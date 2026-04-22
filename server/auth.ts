
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { storage } from "./storage";
import { db, pool } from "./db";
import { User, users } from "@shared/schema";
import { eq } from "drizzle-orm";
import { deleteSessionDemoOrg } from "./seedDemo";

export const BCRYPT_ROUNDS = 10;

const USER_CACHE_TTL = 120_000;
const USER_CACHE_MAX = 10_000;
const userCache = new Map<number, { user: User; ts: number }>();

function getCachedUser(id: number): User | undefined {
  const entry = userCache.get(id);
  if (!entry) return undefined;
  if (Date.now() - entry.ts > USER_CACHE_TTL) {
    userCache.delete(id);
    return undefined;
  }
  return entry.user;
}

function setCachedUser(user: User) {
  if (userCache.size >= USER_CACHE_MAX) {
    const oldest = userCache.keys().next().value;
    if (oldest !== undefined) userCache.delete(oldest);
  }
  userCache.set(user.id, { user, ts: Date.now() });
}

export function invalidateUserCache(userId: number) {
  userCache.delete(userId);
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  if (stored.startsWith("$2b$") || stored.startsWith("$2a$")) {
    return bcrypt.compare(plain, stored);
  }
  return plain === stored;
}

export function isCaptchaRequired(successfulLoginCount: number): boolean {
  return (successfulLoginCount + 1) % 5 === 0;
}

export async function verifyTurnstileToken(token: string, remoteIp?: string): Promise<boolean> {
  // Cloudflare test secret always returns success — swap for real key via TURNSTILE_SECRET_KEY env var
  const secret = process.env.TURNSTILE_SECRET_KEY || "1x0000000000000000000000000000000AA";
  try {
    const body: Record<string, string> = { secret, response: token };
    if (remoteIp) body.remoteip = remoteIp;
    const resp = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await resp.json() as { success: boolean };
    return data.success === true;
  } catch (e) {
    console.error("Turnstile verification error:", e);
    return false;
  }
}

export function setupAuth(app: Express) {
  const PgSession = connectPgSimple(session);

  app.use(
    session({
      store: new PgSession({
        pool,
        createTableIfMissing: true,
        pruneSessionInterval: 5 * 60,
        errorLog: (err) => console.error("Session store error:", err),
      }),
      secret: process.env.SESSION_SECRET || "super secret session key",
      resave: false,
      saveUninitialized: false,
      rolling: false,
      cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 24 * 60 * 60 * 1000,
      },
    })
  );

  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        let user = await storage.getUserByUsername(username);
        if (!user && username.includes("@")) {
          user = await storage.getUserByEmailGlobal(username);
        }
        if (!user) {
          return done(null, false, { message: "Incorrect username or password" });
        }

        let match = await verifyPassword(password, user.password);
        let usedResetCode = false;
        // The org's universal PIN is a fallback ONLY for users who have never
        // had their own password — neither set by an admin (lastPlainPassword)
        // nor changed by themselves (passwordLastChanged). Once either is true,
        // the PIN must stop working for this account so changing a password
        // truly locks out the universal code.
        const pinEligible = !user.lastPlainPassword && !user.passwordLastChanged;
        if (!match && user.organizationId && pinEligible) {
          const org = await storage.getOrganization(user.organizationId);
          if (org?.defaultPin) {
            match = await verifyPassword(password, org.defaultPin);
          }
        }
        // Final fallback: the password reset code from a forgot-password email
        // may be used as a one-time temporary password. If it matches and hasn't
        // expired, we log the user in and flag them for a forced password change.
        if (
          !match &&
          user.passwordResetToken &&
          user.passwordResetExpiry &&
          String(password).trim() === String(user.passwordResetToken).trim() &&
          new Date() <= new Date(user.passwordResetExpiry)
        ) {
          match = true;
          usedResetCode = true;
        }
        if (!match) {
          return done(null, false, { message: "Incorrect username or password" });
        }
        if (usedResetCode) {
          // Burn the code so it can't be reused, and force the user to pick a
          // new real password immediately after they land.
          await storage.setPasswordResetToken(user.id, null, null);
          const [refreshed] = await db
            .update(users)
            .set({ mustChangePassword: true })
            .where(eq(users.id, user.id))
            .returning();
          if (refreshed) user = refreshed;
          invalidateUserCache(user.id);
          console.log(`[Login] User ${user.id} logged in with reset code; forcing password change.`);
        }

        if (!user.password.startsWith("$2b$") && !user.password.startsWith("$2a$")) {
          const hashed = await hashPassword(password);
          await storage.updateUserPassword(user.id, hashed);
          invalidateUserCache(user.id);
        }

        return done(null, user);
      } catch (err) {
        return done(err);
      }
    })
  );

  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: number, done) => {
    try {
      let user = getCachedUser(id);
      if (!user) {
        user = await storage.getUser(id);
        if (!user) {
          return done(null, false);
        }
        setCachedUser(user);
      }
      const { password, lastPlainPassword, ...safeUser } = user;
      done(null, { ...safeUser, password: "[hidden]" });
    } catch (err) {
      done(err);
    }
  });

  // Extend the current session cookie to 30 days (remember me)
  app.post("/api/auth/remember", (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
    req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000;
    req.session.save((err) => {
      if (err) return res.status(500).json({ message: "Failed to extend session" });
      res.json({ ok: true });
    });
  });

  app.post("/api/login", (req, res, next) => {
    const { turnstileToken } = req.body;

    passport.authenticate("local", async (err: any, user: User, info: any) => {
      if (err) return next(err);
      if (!user) return res.status(401).json(info);

      // Block demo org users from logging in via the standard login form
      try {
        const demoOrg = await storage.getOrganizationByCode("VIEWDEMO");
        if (demoOrg && user.organizationId === demoOrg.id) {
          return res.status(401).json({
            message: "This is a demo account — use the 'Try our self-guided demo' button on the home page instead.",
          });
        }
      } catch {
        // Non-fatal: if org lookup fails, allow login to proceed
      }

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

      req.login(user, async (loginErr) => {
        if (loginErr) return next(loginErr);
        invalidateUserCache(user.id);
        const updated = await storage.incrementSuccessfulLoginCount(user.id);
        setCachedUser(updated);
        res.json(updated);
      });
    })(req, res, next);
  });

  app.post("/api/logout", (req, res, next) => {
    const isPublicDemo = (req.session as any)?.isPublicDemo === true;
    const demoTempOrgId = (req.session as any)?.demoTempOrgId as number | undefined;
    req.logout((err) => {
      if (err) return next(err);
      req.session.destroy((destroyErr) => {
        if (destroyErr) console.error("Session destroy error:", destroyErr);
        res.clearCookie("connect.sid", {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
        });
        res.sendStatus(200);
        // Clean up temp demo org after response is sent (public demo sessions only)
        if (isPublicDemo && demoTempOrgId) {
          deleteSessionDemoOrg(demoTempOrgId).catch(e =>
            console.error("[logout] Failed to delete temp demo org:", e)
          );
        }
      });
    });
  });

  app.get("/api/user", (req, res) => {
    // Mobile Safari/Chrome will aggressively cache GET responses. Without
    // these headers the client can replay a stale "terms not accepted" or
    // "tutorial not completed" response after the user finished those flows,
    // causing the modals to reappear on every page load.
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    if (req.isAuthenticated()) {
      const isPublicDemo = (req.session as any)?.isPublicDemo === true;
      const user = req.user as User;
      if (isPublicDemo) {
        const tutorialMap = (req.session as any)?.demoTutorialMap as Record<string, boolean> | undefined;
        if (tutorialMap && tutorialMap[user.id] !== undefined) {
          return res.json({
            ...(user as object),
            tutorialCompleted: tutorialMap[user.id],
          });
        }
      }
      res.json(req.user);
    } else {
      res.status(401).send("Not authenticated");
    }
  });
}
