import crypto from "crypto";

function getSecret(): string {
  let s = process.env.WALLET_QR_SECRET;
  if (!s) {
    if (!process.env.SESSION_SECRET) {
      console.warn("[wallet] WALLET_QR_SECRET not set; using ephemeral fallback (tokens will not survive restart)");
      (process.env as any).WALLET_QR_SECRET = crypto.randomBytes(32).toString("hex");
      s = process.env.WALLET_QR_SECRET!;
    } else {
      s = "wallet:" + process.env.SESSION_SECRET;
    }
  }
  return s;
}

function b64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlDecode(s: string): Buffer {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  return Buffer.from(s, "base64");
}

export interface WalletQrPayload {
  e: number; // employeeId
  o: number; // orgId
  s: string; // pass serialNumber
  n: string; // nonce
  x: number; // expires (ms epoch)
}

/** Issues a short-lived signed QR token. Default TTL 5 minutes. */
export function signWalletQr(payload: Omit<WalletQrPayload, "n" | "x">, ttlSeconds = 300): string {
  const full: WalletQrPayload = {
    ...payload,
    n: crypto.randomBytes(8).toString("hex"),
    x: Date.now() + ttlSeconds * 1000,
  };
  const body = b64url(Buffer.from(JSON.stringify(full)));
  const sig = b64url(crypto.createHmac("sha256", getSecret()).update(body).digest());
  return `bbw1.${body}.${sig}`;
}

export function verifyWalletQr(token: string): WalletQrPayload | null {
  try {
    if (!token || typeof token !== "string") return null;
    const parts = token.split(".");
    if (parts.length !== 3 || parts[0] !== "bbw1") return null;
    const [, body, sig] = parts;
    const expected = b64url(crypto.createHmac("sha256", getSecret()).update(body).digest());
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    const payload = JSON.parse(b64urlDecode(body).toString("utf8")) as WalletQrPayload;
    if (typeof payload.x !== "number" || payload.x < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}
