import http2 from "http2";
import crypto from "crypto";

let cachedJwt: { token: string; createdAt: number } | null = null;

function getApnsConfig() {
  const keyB64 = process.env.APPLE_APN_KEY;
  const keyId = process.env.APPLE_APN_KEY_ID;
  const teamId = process.env.APPLE_TEAM_ID;
  const topic = process.env.APPLE_PASS_TYPE_ID;
  if (!keyB64 || !keyId || !teamId || !topic) return null;
  let key: string;
  try {
    key = Buffer.from(keyB64, "base64").toString("utf8");
    if (!key.includes("BEGIN")) throw new Error("decoded APNs key is not PEM");
  } catch (e: any) {
    console.error("[apns] APPLE_APN_KEY is not valid base64-encoded PEM:", e?.message);
    return null;
  }
  return { key, keyId, teamId, topic };
}

function buildJwt(cfg: { key: string; keyId: string; teamId: string }) {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "ES256", kid: cfg.keyId, typ: "JWT" })).toString("base64url");
  const claims = Buffer.from(JSON.stringify({ iss: cfg.teamId, iat: now })).toString("base64url");
  const signingInput = `${header}.${claims}`;
  const signer = crypto.createSign("SHA256");
  signer.update(signingInput);
  signer.end();
  const der = signer.sign({ key: cfg.key, dsaEncoding: "ieee-p1363" });
  const sig = der.toString("base64url");
  return `${signingInput}.${sig}`;
}

function getJwt(cfg: { key: string; keyId: string; teamId: string }) {
  if (cachedJwt && Date.now() - cachedJwt.createdAt < 50 * 60 * 1000) return cachedJwt.token;
  const tok = buildJwt(cfg);
  cachedJwt = { token: tok, createdAt: Date.now() };
  return tok;
}

/**
 * Sends an empty-body APNs push to the given device tokens telling Apple Wallet
 * to refresh the pass. Returns gracefully (no-op) when APNs is not configured.
 */
export async function pushPassUpdate(deviceTokens: string[]): Promise<{ sent: number; configured: boolean; errors: number }> {
  const cfg = getApnsConfig();
  if (!cfg) {
    if (deviceTokens.length) console.warn(`[apns] Skipping pass push to ${deviceTokens.length} device(s) — Apple credentials not configured`);
    return { sent: 0, configured: false, errors: 0 };
  }
  if (!deviceTokens.length) return { sent: 0, configured: true, errors: 0 };
  const jwt = getJwt(cfg);
  const client = http2.connect("https://api.push.apple.com:443");
  let sent = 0, errors = 0;
  await new Promise<void>((resolve) => {
    let pending = deviceTokens.length;
    const finish = () => { if (--pending === 0) resolve(); };
    for (const token of deviceTokens) {
      const req = client.request({
        ":method": "POST",
        ":path": `/3/device/${token}`,
        "apns-topic": cfg.topic,
        "apns-push-type": "background",
        authorization: `bearer ${jwt}`,
      });
      req.setEncoding("utf8");
      let status = 0;
      req.on("response", (h) => { status = Number(h[":status"]) || 0; });
      let body = "";
      req.on("data", (c) => { body += c; });
      req.on("end", () => {
        if (status >= 200 && status < 300) sent++;
        else { errors++; console.warn(`[apns] push to ${token.slice(0,8)}… status=${status} body=${body}`); }
        finish();
      });
      req.on("error", (err) => { errors++; console.warn(`[apns] push error:`, err?.message); finish(); });
      req.end(JSON.stringify({}));
    }
  });
  client.close();
  return { sent, configured: true, errors };
}
