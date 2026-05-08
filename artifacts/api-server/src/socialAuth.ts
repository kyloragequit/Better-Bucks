import crypto from "crypto";
import https from "https";

type SocialIdentity = {
  providerUserId: string;
  email: string | null;
};

function httpsGet(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => resolve(data));
      })
      .on("error", reject);
  });
}

function base64urlDecode(s: string): Buffer {
  const padded = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad = (4 - (padded.length % 4)) % 4;
  return Buffer.from(padded + "=".repeat(pad), "base64");
}

function parseJwtUnsafe(token: string): { header: Record<string, string>; payload: Record<string, unknown> } | null {
  try {
    const parts = token.split(".");
    if (parts.length < 3) return null;
    const header = JSON.parse(base64urlDecode(parts[0]!).toString("utf8"));
    const payload = JSON.parse(base64urlDecode(parts[1]!).toString("utf8"));
    return { header, payload };
  } catch {
    return null;
  }
}

let appleJwksCache: { keys: AppleJwk[]; fetchedAt: number } | null = null;
const APPLE_JWKS_TTL_MS = 60 * 60 * 1000;

type AppleJwk = {
  kty: string;
  kid: string;
  use: string;
  alg: string;
  n?: string;
  e?: string;
  crv?: string;
  x?: string;
  y?: string;
};

async function fetchAppleJwks(): Promise<AppleJwk[]> {
  if (appleJwksCache && Date.now() - appleJwksCache.fetchedAt < APPLE_JWKS_TTL_MS) {
    return appleJwksCache.keys;
  }
  const raw = await httpsGet("https://appleid.apple.com/auth/keys");
  const { keys } = JSON.parse(raw) as { keys: AppleJwk[] };
  appleJwksCache = { keys, fetchedAt: Date.now() };
  return keys;
}

function jwkToPublicKey(jwk: AppleJwk): crypto.KeyObject {
  if (jwk.kty === "RSA" && jwk.n && jwk.e) {
    return crypto.createPublicKey({ key: jwk as unknown as Parameters<typeof crypto.createPublicKey>[0] & object, format: "jwk" });
  }
  if (jwk.kty === "EC" && jwk.crv && jwk.x && jwk.y) {
    return crypto.createPublicKey({ key: jwk as unknown as Parameters<typeof crypto.createPublicKey>[0] & object, format: "jwk" });
  }
  throw new Error("Unsupported JWK key type");
}

export async function verifyAppleIdentityToken(identityToken: string): Promise<SocialIdentity> {
  const parsed = parseJwtUnsafe(identityToken);
  if (!parsed) throw new Error("Invalid identity token format");

  const { header, payload } = parsed;
  const kid = header["kid"];
  if (!kid) throw new Error("Missing kid in token header");

  const now = Math.floor(Date.now() / 1000);
  const exp = payload["exp"] as number | undefined;
  const iss = payload["iss"] as string | undefined;
  const aud = payload["aud"] as string | undefined;

  if (!exp || now > exp) throw new Error("Identity token expired");
  if (iss !== "https://appleid.apple.com") throw new Error("Invalid issuer");

  const keys = await fetchAppleJwks();
  const jwk = keys.find((k) => k.kid === kid);
  if (!jwk) throw new Error("No matching Apple public key found");

  const publicKey = jwkToPublicKey(jwk);
  const [headerB64, payloadB64, sigB64] = identityToken.split(".");
  const signingInput = `${headerB64}.${payloadB64}`;
  const signature = base64urlDecode(sigB64!);

  const alg = header["alg"] ?? "RS256";
  const cryptoAlg = alg === "ES256" ? "SHA256" : "SHA256";

  const valid = crypto.verify(cryptoAlg, Buffer.from(signingInput, "utf8"), publicKey, signature);
  if (!valid) throw new Error("Apple identity token signature invalid");

  const sub = payload["sub"] as string | undefined;
  const email = payload["email"] as string | undefined;

  if (!sub) throw new Error("Missing sub in Apple token payload");

  return { providerUserId: sub, email: email ?? null };
}

export async function verifyGoogleIdToken(idToken: string): Promise<SocialIdentity> {
  const url = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`;
  let raw: string;
  try {
    raw = await httpsGet(url);
  } catch {
    throw new Error("Could not reach Google to verify identity token");
  }

  let info: Record<string, unknown>;
  try {
    info = JSON.parse(raw);
  } catch {
    throw new Error("Invalid response from Google token verification");
  }

  if (info["error"]) {
    throw new Error(`Google token verification failed: ${info["error"]}`);
  }

  const exp = Number(info["exp"]);
  if (!exp || Date.now() / 1000 > exp) throw new Error("Google ID token expired");

  const sub = info["sub"] as string | undefined;
  const email = info["email"] as string | undefined;

  if (!sub) throw new Error("Missing sub in Google token");

  return { providerUserId: sub, email: email ?? null };
}
