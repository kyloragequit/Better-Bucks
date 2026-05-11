import http2 from "http2";
import crypto from "crypto";
import { logger } from "./lib/logger";

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
    logger.error({ err: e }, "[apns] APPLE_APN_KEY is not valid base64-encoded PEM");
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

/** Returns true for HTTP status codes that represent a transient APNs failure worth retrying. */
function isTransientStatus(status: number): boolean {
  return status === 429 || (status >= 500 && status < 600);
}

/** APNs error reasons in a 400 response that mean the device token is permanently invalid. */
const INVALID_TOKEN_REASONS = new Set(["BadDeviceToken", "DeviceTokenNotForTopic"]);

/** Parse APNs JSON error body and return the `reason` string, or undefined if not parseable. */
function parseApnsReason(body: string): string | undefined {
  try {
    const parsed = JSON.parse(body) as { reason?: string };
    return parsed.reason;
  } catch {
    return undefined;
  }
}

/**
 * Send a single APNs push to one device token over an existing HTTP/2 client.
 * Returns the HTTP status and response body.
 */
function sendOne(
  client: http2.ClientHttp2Session,
  token: string,
  topic: string,
  jwt: string,
): Promise<{ status: number; body: string }> {
  return new Promise((resolve) => {
    const req = client.request({
      ":method": "POST",
      ":path": `/3/device/${token}`,
      "apns-topic": topic,
      "apns-push-type": "background",
      authorization: `bearer ${jwt}`,
    });
    req.setEncoding("utf8");
    let status = 0;
    req.on("response", (h) => { status = Number(h[":status"]) || 0; });
    let body = "";
    req.on("data", (c) => { body += c; });
    req.on("end", () => resolve({ status, body }));
    req.on("error", (err) => {
      logger.warn({ err, tokenPrefix: token.slice(0, 8) }, "[apns] request error for device token");
      resolve({ status: 0, body: err?.message ?? "request error" });
    });
    req.end(JSON.stringify({}));
  });
}

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 500;

/**
 * Sends an empty-body APNs push to the given device tokens telling Apple Wallet
 * to refresh the pass. Returns gracefully (no-op) when APNs is not configured.
 *
 * Failed pushes are retried up to MAX_RETRIES times with exponential back-off.
 * Tokens that Apple rejects as permanently invalid (HTTP 410, or HTTP 400 with
 * reason BadDeviceToken/DeviceTokenNotForTopic) are collected in `invalidTokens`
 * so the caller can remove them from the database.
 */
export async function pushPassUpdate(
  deviceTokens: string[],
): Promise<{ sent: number; configured: boolean; errors: number; invalidTokens: string[] }> {
  const cfg = getApnsConfig();
  if (!cfg) {
    if (deviceTokens.length) logger.warn({ count: deviceTokens.length }, "[apns] Skipping pass push — Apple credentials not configured");
    return { sent: 0, configured: false, errors: 0, invalidTokens: [] };
  }
  if (!deviceTokens.length) return { sent: 0, configured: true, errors: 0, invalidTokens: [] };

  const jwt = getJwt(cfg);
  const client = http2.connect("https://api.push.apple.com:443");

  let sent = 0;
  let errors = 0;
  const invalidTokens: string[] = [];

  await Promise.all(
    deviceTokens.map(async (token) => {
      let attempt = 0;
      while (attempt < MAX_RETRIES) {
        const { status, body } = await sendOne(client, token, cfg.topic, jwt);

        if (status >= 200 && status < 300) {
          sent++;
          return;
        }

        if (status === 410) {
          // Token is permanently invalid; no point retrying.
          logger.warn({ tokenPrefix: token.slice(0, 8), status }, "[apns] Token rejected as permanently invalid — will be removed");
          invalidTokens.push(token);
          return;
        }

        if (status === 400) {
          const reason = parseApnsReason(body);
          if (reason && INVALID_TOKEN_REASONS.has(reason)) {
            // Apple explicitly told us the token is bad; remove it and don't retry.
            logger.warn({ tokenPrefix: token.slice(0, 8), reason }, "[apns] Token rejected with permanent error — will be removed");
            invalidTokens.push(token);
            return;
          }
        }

        attempt++;
        if (attempt < MAX_RETRIES && (status === 0 || isTransientStatus(status))) {
          const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
          logger.warn({ tokenPrefix: token.slice(0, 8), status, attempt, maxRetries: MAX_RETRIES, delayMs: delay }, "[apns] Transient push failure — retrying");
          await new Promise((r) => setTimeout(r, delay));
        } else {
          errors++;
          logger.warn({ tokenPrefix: token.slice(0, 8), status, attempt }, "[apns] Push failed after all inline retry attempts");
          return;
        }
      }
    }),
  );

  client.close();
  return { sent, configured: true, errors, invalidTokens };
}
