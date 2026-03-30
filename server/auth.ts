
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { storage } from "./storage";
import { pool } from "./db";
import { User } from "@shared/schema";

export const BCRYPT_ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  if (stored.startsWith("$2b$") || stored.startsWith("$2a$")) {
    return bcrypt.compare(plain, stored);
  }
  return plain === stored;
}

function getCaptchaSecret(): string {
  return process.env.SESSION_SECRET || "super secret session key";
}

export function generateCaptchaChallenge(): { question: string; token: string } {
  const num1 = Math.floor(Math.random() * 20) + 1;
  const num2 = Math.floor(Math.random() * 20) + 1;
  const answer = num1 + num2;
  const expiresAt = Date.now() + 5 * 60 * 1000;
  const payload = Buffer.from(JSON.stringify({ answer, expiresAt })).toString("base64url");
  const sig = crypto.createHmac("sha256", getCaptchaSecret()).update(`${answer}:${expiresAt}`).digest("hex");
  return {
    question: `What is ${num1} + ${num2}?`,
    token: `${payload}.${sig}`,
  };
}

export function verifyCaptchaToken(token: string, userAnswer: string): boolean {
  try {
    const [payloadB64, sig] = token.split(".");
    if (!payloadB64 || !sig) return false;
    const { answer, expiresAt } = JSON.parse(Buffer.from(payloadB64, "base64url").toString());
    if (Date.now() > expiresAt) return false;
    const expected = crypto.createHmac("sha256", getCaptchaSecret()).update(`${answer}:${expiresAt}`).digest("hex");
    if (!crypto.timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex"))) return false;
    return parseInt(userAnswer, 10) === answer;
  } catch {
    return false;
  }
}

export function isCaptchaRequired(successfulLoginCount: number): boolean {
  return (successfulLoginCount + 1) % 5 === 0;
}

export function setupAuth(app: Express) {
  const PgSession = connectPgSimple(session);

  app.use(
    session({
      store: new PgSession({
        pool,
        createTableIfMissing: true,
        pruneSessionInterval: 60 * 60,   // prune expired sessions every hour
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
        maxAge: 24 * 60 * 60 * 1000,   // 24h default; remember-me extends to 30d
      },
    })
  );

  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await storage.getUserByUsername(username);
        if (!user) {
          return done(null, false, { message: "Incorrect username or password" });
        }

        let match = await verifyPassword(password, user.password);
        if (!match && user.organizationId) {
          // Fallback: try the org's universal PIN
          const org = await storage.getOrganization(user.organizationId);
          if (org?.defaultPin) {
            match = await verifyPassword(password, org.defaultPin);
          }
        }
        if (!match) {
          return done(null, false, { message: "Incorrect username or password" });
        }

        if (!user.password.startsWith("$2b$") && !user.password.startsWith("$2a$")) {
          const hashed = await hashPassword(password);
          await storage.updateUserPassword(user.id, hashed);
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
      const user = await storage.getUser(id);
      if (!user) {
        return done(null, false);
      }
      done(null, user);
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
    const { captchaToken, captchaAnswer } = req.body;

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
        if (!captchaToken || !captchaAnswer) {
          const challenge = generateCaptchaChallenge();
          return res.status(200).json({
            captchaRequired: true,
            question: challenge.question,
            token: challenge.token,
          });
        }

        if (!verifyCaptchaToken(captchaToken, captchaAnswer)) {
          const challenge = generateCaptchaChallenge();
          return res.status(200).json({
            captchaRequired: true,
            question: challenge.question,
            token: challenge.token,
            error: "Incorrect answer. Please try again.",
          });
        }
      }

      req.login(user, async (loginErr) => {
        if (loginErr) return next(loginErr);
        const updated = await storage.incrementSuccessfulLoginCount(user.id);
        res.json(updated);
      });
    })(req, res, next);
  });

  app.post("/api/logout", (req, res, next) => {
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
      });
    });
  });

  app.get("/api/user", (req, res) => {
    if (req.isAuthenticated()) {
      // For public demo sessions, overlay the session-tracked tutorial state
      // so the tutorial hook reflects completion without any DB write
      const isPublicDemo = (req.session as any)?.isPublicDemo === true;
      if (isPublicDemo && (req.session as any)?.demoTutorialCompleted !== undefined) {
        return res.json({
          ...(req.user as object),
          tutorialCompleted: (req.session as any).demoTutorialCompleted,
        });
      }
      res.json(req.user);
    } else {
      res.status(401).send("Not authenticated");
    }
  });
}
