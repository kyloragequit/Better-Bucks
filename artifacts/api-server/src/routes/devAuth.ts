import * as oidc from "openid-client";
import { Router, type Request, type Response } from "express";
import { db, users } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";

const router = Router();

const ISSUER_URL = "https://replit.com/oidc";
const OIDC_COOKIE_TTL = 10 * 60 * 1000; // 10 minutes

let _config: oidc.Configuration | null = null;
async function getOidcConfig(): Promise<oidc.Configuration> {
  if (_config) return _config;
  _config = await oidc.discovery(new URL(ISSUER_URL), process.env.REPL_ID!);
  return _config;
}

function getOrigin(req: Request): string {
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers["x-forwarded-host"] || req.headers["host"] || "localhost";
  return `${proto}://${host}`;
}

function setOidcCookie(res: Response, name: string, value: string) {
  res.cookie(`devauth_${name}`, value, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: OIDC_COOKIE_TTL,
  });
}

function clearOidcCookies(res: Response) {
  for (const name of ["code_verifier", "nonce", "state"]) {
    res.clearCookie(`devauth_${name}`, { path: "/" });
  }
}

// GET /api/dev-auth/login — start OIDC PKCE flow
router.get("/login", async (req: Request, res: Response) => {
  try {
    const config = await getOidcConfig();
    const callbackUrl = `${getOrigin(req)}/api/dev-auth/callback`;

    const state = oidc.randomState();
    const nonce = oidc.randomNonce();
    const codeVerifier = oidc.randomPKCECodeVerifier();
    const codeChallenge = await oidc.calculatePKCECodeChallenge(codeVerifier);

    const redirectTo = oidc.buildAuthorizationUrl(config, {
      redirect_uri: callbackUrl,
      scope: "openid email profile",
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
      prompt: "login consent",
      state,
      nonce,
    });

    setOidcCookie(res, "code_verifier", codeVerifier);
    setOidcCookie(res, "nonce", nonce);
    setOidcCookie(res, "state", state);

    res.redirect(redirectTo.href);
  } catch (err) {
    logger.error({ err }, "[devAuth] Failed to start OIDC flow");
    res.redirect("/login?error=oidc_init_failed");
  }
});

// GET /api/dev-auth/callback — OIDC callback, match to developer user, log in via Passport
router.get("/callback", async (req: Request, res: Response) => {
  const codeVerifier = req.cookies?.devauth_code_verifier;
  const nonce = req.cookies?.devauth_nonce;
  const expectedState = req.cookies?.devauth_state;

  clearOidcCookies(res);

  if (!codeVerifier || !expectedState) {
    return res.redirect("/login?error=missing_oidc_state");
  }

  let tokens: oidc.TokenEndpointResponse & oidc.TokenEndpointResponseHelpers;
  try {
    const config = await getOidcConfig();
    const callbackUrl = `${getOrigin(req)}/api/dev-auth/callback`;
    const currentUrl = new URL(
      `${callbackUrl}?${new URL(req.url, `http://${req.headers.host}`).searchParams}`,
    );
    tokens = await oidc.authorizationCodeGrant(config, currentUrl, {
      pkceCodeVerifier: codeVerifier,
      expectedNonce: nonce,
      expectedState,
      idTokenExpected: true,
    });
  } catch (err) {
    logger.error({ err }, "[devAuth] OIDC token exchange failed");
    return res.redirect("/login?error=auth_failed");
  }

  const claims = tokens.claims();
  if (!claims) {
    return res.redirect("/login?error=no_claims");
  }

  const replitUsername = (claims.username ?? claims.preferred_username ?? claims.sub) as string;
  const replitEmail = claims.email as string | undefined;

  // Only the designated developer Replit account is allowed
  const ALLOWED_REPLIT_USERNAME = process.env.DEVELOPER_REPLIT_USERNAME ?? "milesgchase";
  if (replitUsername !== ALLOWED_REPLIT_USERNAME) {
    logger.warn({ replitUsername }, "[devAuth] Unauthorized Replit login attempt");
    return res.redirect("/login?error=not_authorized");
  }

  // Find or auto-create the developer user linked to this Replit account
  let devUser: typeof users.$inferSelect | undefined;

  const [found] = await db
    .select()
    .from(users)
    .where(eq(users.username, replitUsername))
    .limit(1);

  if (found?.role === "developer") {
    devUser = found;
  } else if (!found) {
    // Auto-create developer account on first login
    const [created] = await db.insert(users).values({
      username: replitUsername,
      password: "",
      fullName: "Developer",
      role: "developer",
      status: "approved",
      barcode: replitUsername,
      balance: 0,
      email: replitEmail ?? null,
    }).returning();
    devUser = created;
    logger.info({ replitUsername }, "[devAuth] Developer user auto-created");
  } else {
    // User exists but isn't a developer — deny
    logger.warn({ replitUsername }, "[devAuth] Replit identity not matched to any developer account");
    return res.redirect("/login?error=not_authorized");
  }

  // Use Passport's req.login so the existing session/middleware stack sees a normal session
  req.login(devUser, (err) => {
    if (err) {
      logger.error({ err }, "[devAuth] req.login failed");
      return res.redirect("/login?error=session_failed");
    }
    res.redirect("/developer/dashboard");
  });
});

// GET /api/dev-auth/logout — clear Passport session and redirect to Replit end-session
router.get("/logout", async (req: Request, res: Response) => {
  const origin = getOrigin(req);
  req.logout((err) => {
    if (err) logger.error({ err }, "[devAuth] logout error");
  });
  try {
    const config = await getOidcConfig();
    const endSessionUrl = oidc.buildEndSessionUrl(config, {
      client_id: process.env.REPL_ID!,
      post_logout_redirect_uri: `${origin}/developer`,
    });
    res.redirect(endSessionUrl.href);
  } catch {
    res.redirect("/developer");
  }
});

export default router;
