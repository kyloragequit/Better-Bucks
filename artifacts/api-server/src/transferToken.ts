import crypto from "crypto";

function getSecret(): string {
  const s = process.env.SESSION_SECRET;
  if (s && s.length >= 16) return "transfer:" + s;
  return "transfer:dev-fallback-secret-do-not-use-in-prod";
}

function b64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string): Buffer {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  return Buffer.from(s, "base64");
}

export interface TransferTokenPayload {
  tid: number;          // transfer DB row id
  s: number;            // senderId
  r: number | null;     // recipientId (null = any recipient, for nfc/qr)
  a: number;            // amount in Bucks
  m: "nfc" | "qr" | "direct";
  n: string;            // random nonce (ensures uniqueness)
  x: number;            // expiry — unix epoch ms
}

/**
 * Issue a signed, time-bound transfer token.
 * Default TTLs: 60 s (NFC), 300 s (QR), 3600 s (direct).
 */
export function signTransferToken(
  payload: Omit<TransferTokenPayload, "n" | "x">,
  ttlSeconds = 60,
): string {
  const full: TransferTokenPayload = {
    ...payload,
    n: crypto.randomBytes(12).toString("hex"),
    x: Date.now() + ttlSeconds * 1000,
  };
  const body = b64url(Buffer.from(JSON.stringify(full)));
  const sig = b64url(crypto.createHmac("sha256", getSecret()).update(body).digest());
  return `bbt1.${body}.${sig}`;
}

/** SHA-256 the raw token string — stored in DB for single-use enforcement. */
export function hashTransferToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Verify signature and expiry.
 * Returns the decoded payload on success, null otherwise.
 */
export function verifyTransferToken(token: string): TransferTokenPayload | null {
  try {
    if (!token || typeof token !== "string") return null;
    const parts = token.split(".");
    if (parts.length !== 3 || parts[0] !== "bbt1") return null;
    const [, body, sig] = parts;
    const expected = b64url(
      crypto.createHmac("sha256", getSecret()).update(body!).digest(),
    );
    if (
      sig!.length !== expected.length ||
      !crypto.timingSafeEqual(Buffer.from(sig!), Buffer.from(expected))
    ) {
      return null;
    }
    const payload = JSON.parse(
      b64urlDecode(body!).toString("utf8"),
    ) as TransferTokenPayload;
    if (typeof payload.x !== "number" || payload.x < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}
