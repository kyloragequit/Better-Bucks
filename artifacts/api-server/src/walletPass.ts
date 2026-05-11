import { storage } from "./storage";
import { signWalletQr } from "./walletQrToken";
import { pushPassUpdate } from "./apns";
import { recordApnsPushRetry } from "./apnsPushRetry";
import { logger } from "./lib/logger";
import crypto from "crypto";
import forge from "node-forge";

export class PassConfigError extends Error {}

interface PassEnv {
  passTypeId: string;
  teamId: string;
  signerCertPem: Buffer;
  signerKeyPem: Buffer;
  signerKeyPassphrase: string;
  wwdr: Buffer;
  webServiceURL: string;
}

/** Parse an Apple Pass Type .p12 (PKCS#12) bag into PEM-encoded cert + private key, suitable for passkit-generator's `signerCert` / `signerKey` fields. */
function p12ToPem(p12Buffer: Buffer, password: string): { certPem: string; keyPem: string; keyPassphrase: string } {
  const p12Asn1 = forge.asn1.fromDer(forge.util.createBuffer(p12Buffer.toString("binary")));
  const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, password);
  let cert: forge.pki.Certificate | null = null;
  let key: forge.pki.PrivateKey | null = null;
  for (const safeContents of p12.safeContents) {
    for (const safeBag of safeContents.safeBags) {
      if (safeBag.type === forge.pki.oids.certBag && safeBag.cert) cert = safeBag.cert;
      else if ((safeBag.type === forge.pki.oids.pkcs8ShroudedKeyBag || safeBag.type === forge.pki.oids.keyBag) && safeBag.key) key = safeBag.key;
    }
  }
  if (!cert) throw new PassConfigError("APPLE_PASS_CERT_P12 does not contain a certificate (check file or password).");
  if (!key) throw new PassConfigError("APPLE_PASS_CERT_P12 does not contain a private key (check file or password).");
  const keyPassphrase = "betterbucks-internal";
  const keyPem = forge.pki.encryptRsaPrivateKey(key as forge.pki.rsa.PrivateKey, keyPassphrase);
  const certPem = forge.pki.certificateToPem(cert);
  return { certPem, keyPem, keyPassphrase };
}

function getPassEnv(req?: any): PassEnv {
  const passTypeId = process.env.APPLE_PASS_TYPE_ID;
  const teamId = process.env.APPLE_TEAM_ID;
  const certB64 = process.env.APPLE_PASS_CERT_P12;
  const certPwd = process.env.APPLE_PASS_CERT_PASSWORD || "";
  const wwdrB64 = process.env.APPLE_WWDR_CERT;
  if (!passTypeId || !teamId || !certB64 || !wwdrB64) {
    const missing = [
      !passTypeId && "APPLE_PASS_TYPE_ID",
      !teamId && "APPLE_TEAM_ID",
      !certB64 && "APPLE_PASS_CERT_P12",
      !wwdrB64 && "APPLE_WWDR_CERT",
    ].filter(Boolean).join(", ");
    throw new PassConfigError(`Apple Wallet is not configured. Missing secret(s): ${missing}. Ask your administrator to add them in Replit Secrets.`);
  }
  const certP12 = Buffer.from(certB64, "base64");
  const wwdr = Buffer.from(wwdrB64, "base64");
  const baseUrl =
    process.env.PUBLIC_BASE_URL ||
    process.env.REPLIT_DEPLOYMENT_URL ||
    (process.env.REPLIT_DOMAINS ? `https://${process.env.REPLIT_DOMAINS.split(",")[0].trim()}` : null) ||
    (req ? `${req.protocol}://${req.get("host")}` : null);
  if (!baseUrl) throw new PassConfigError("Could not determine public base URL for Apple Wallet web service");
  let pem: { certPem: string; keyPem: string; keyPassphrase: string };
  try {
    pem = p12ToPem(certP12, certPwd);
  } catch (err: any) {
    if (err instanceof PassConfigError) throw err;
    throw new PassConfigError(`Could not parse APPLE_PASS_CERT_P12 (check that it is a valid Apple Pass Type .p12 and that APPLE_PASS_CERT_PASSWORD is correct): ${err?.message ?? err}`);
  }
  return {
    passTypeId,
    teamId,
    signerCertPem: Buffer.from(pem.certPem),
    signerKeyPem: Buffer.from(pem.keyPem),
    signerKeyPassphrase: pem.keyPassphrase,
    wwdr,
    webServiceURL: `${baseUrl}/api/wallet`,
  };
}

const TINY_PNG_1x1 = Buffer.from(
  "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489000000017352474200aece1ce90000000d49444154789c63f8cf0000000003000119cb6cdc0000000049454e44ae426082",
  "hex"
);

/** Lazy-create or fetch the wallet pass row for an employee. Pass forceReissue=true to invalidate any prior active serial and mint a new one. */
export async function ensureWalletPassForEmployee(employeeId: number, opts: { forceReissue?: boolean } = {}) {
  const existing = await storage.getActiveWalletPassForEmployee(employeeId);
  if (existing && !opts.forceReissue) return existing;
  if (existing && opts.forceReissue) {
    await storage.deactivateWalletPass(existing.serialNumber);
  }
  const serialNumber = `bb-${employeeId}-${crypto.randomBytes(8).toString("hex")}`;
  const authToken = crypto.randomBytes(24).toString("hex");
  return storage.createWalletPass({ serialNumber, employeeId, authToken, active: true });
}

export interface BuiltPass {
  buffer: Buffer;
  serialNumber: string;
  authToken: string;
  updatedTag: string;
}

export async function buildPassForEmployee(
  employeeId: number,
  req?: any,
  opts?: { serialNumber?: string },
): Promise<BuiltPass> {
  const env = getPassEnv(req);
  const employee = await storage.getUser(employeeId);
  if (!employee) throw new Error("Employee not found");
  const org = employee.organizationId ? await storage.getOrganization(employee.organizationId) : null;
  let pass;
  if (opts?.serialNumber) {
    const requested = await storage.getWalletPassBySerial(opts.serialNumber);
    if (!requested || requested.employeeId !== employeeId || !requested.active) {
      throw new Error("Pass not active for this serial");
    }
    pass = requested;
  } else {
    pass = await ensureWalletPassForEmployee(employeeId);
  }

  // Long-lived signed barcode token: Apple Wallet does not refresh barcode payload at high cadence.
  // Replay/revocation safety comes from serial validation at redeem time — re-issuing a pass deactivates
  // the old serial and any token referencing it is rejected immediately. The visible in-app QR (separate
  // endpoint /api/wallet/qr-token) keeps the original 5-min rotation for defense-in-depth on screens.
  const qrToken = signWalletQr({ e: employeeId, o: employee.organizationId || 0, s: pass.serialNumber }, 60 * 60 * 24 * 30);
  const updatedTag = `${Date.now()}`;
  // Use the persisted lastUpdatedTag so the pass face timestamp matches what PassKit
  // stored when the balance actually changed. Fall back to the new updatedTag only
  // if this is a brand-new pass that has never been tagged yet.
  const displayTag = pass.lastUpdatedTag ?? updatedTag;

  const passJson: any = {
    formatVersion: 1,
    passTypeIdentifier: env.passTypeId,
    serialNumber: pass.serialNumber,
    teamIdentifier: env.teamId,
    organizationName: org?.name || "Better Bucks",
    description: `${org?.name || "Better Bucks"} Bucks balance`,
    logoText: org?.name || "Better Bucks",
    foregroundColor: "rgb(255, 255, 255)",
    backgroundColor: "rgb(22, 42, 74)",
    labelColor: "rgb(180, 200, 230)",
    webServiceURL: env.webServiceURL,
    authenticationToken: pass.authToken,
    barcodes: [
      { format: "PKBarcodeFormatQR", message: qrToken, messageEncoding: "iso-8859-1", altText: "Tap to scan" },
    ],
    storeCard: {
      headerFields: [
        { key: "balance", label: "Bucks", value: `${employee.balance ?? 0}`, textAlignment: "PKTextAlignmentRight" },
      ],
      primaryFields: [
        { key: "name", label: "Member", value: employee.fullName || employee.email || "Member" },
      ],
      secondaryFields: [
        { key: "org", label: "Workplace", value: org?.name || "Better Bucks" },
      ],
      auxiliaryFields: [
        {
          key: "lastUpdated",
          label: "Balance updated",
          value: new Date(Number(displayTag)).toISOString(),
          dateStyle: "PKDateStyleNone",
          timeStyle: "PKDateStyleShort",
        },
      ],
      backFields: [
        { key: "instructions", label: "How to use", value: "Show this pass to a participating merchant. They will scan the QR code to redeem your Bucks. The QR code refreshes every few minutes for security." },
        { key: "balanceBack", label: "Current Bucks balance", value: `${employee.balance ?? 0}` },
      ],
    },
  };

  // Lazy-load passkit-generator (it's CommonJS).
  const pkg: any = await import("passkit-generator");
  const PKPass = pkg.PKPass || pkg.default?.PKPass || pkg.default;
  const buffers: Record<string, Buffer> = {
    "pass.json": Buffer.from(JSON.stringify(passJson)),
    "icon.png": TINY_PNG_1x1,
    "icon@2x.png": TINY_PNG_1x1,
    "logo.png": TINY_PNG_1x1,
    "logo@2x.png": TINY_PNG_1x1,
  };
  const passInstance = new PKPass(buffers, {
    signerCert: env.signerCertPem,
    signerKey: env.signerKeyPem,
    signerKeyPassphrase: env.signerKeyPassphrase,
    wwdr: env.wwdr,
  });
  const buffer = await passInstance.getAsBuffer();
  // Only write the tag when the pass has never been tagged (brand-new serial).
  // Existing tags are set by pushPassUpdateForEmployee when the balance actually
  // changes, so overwriting them here would replace the balance-change timestamp
  // with the pass-fetch time, making the "Balance updated" field inaccurate.
  if (!pass.lastUpdatedTag) {
    await storage.updateWalletPassTag(pass.serialNumber, updatedTag);
  }
  return { buffer, serialNumber: pass.serialNumber, authToken: pass.authToken, updatedTag };
}

/** Trigger an APNs push to all devices that registered the employee's pass. No-op if APNs not configured.
 *
 * Transient failures are retried inline by apns.ts (up to 3 attempts with exponential back-off).
 * If all inline retries are exhausted, or if the connection itself fails, the push is queued in
 * the database and the background APNs retry job will attempt it again up to 5 times.
 * Any token Apple marks as permanently invalid (HTTP 410) is removed from the database
 * immediately so it is never used again. Errors are swallowed so a push failure never
 * breaks a balance update. */
export async function pushPassUpdateForEmployee(employeeId: number): Promise<void> {
  try {
    const pass = await storage.getActiveWalletPassForEmployee(employeeId);
    if (!pass) return;
    await storage.updateWalletPassTag(pass.serialNumber, `${Date.now()}`);
    const devices = await storage.listWalletDevicesForSerial(pass.serialNumber);
    if (!devices.length) return;
    const tokens = Array.from(new Set(devices.map((d) => d.pushToken)));
    const result = await pushPassUpdate(tokens);
    if (result.invalidTokens.length) {
      logger.warn(
        { employeeId, count: result.invalidTokens.length },
        "[walletPass] Removing invalid device token(s)",
      );
      await storage.deleteWalletDevicesByPushToken(result.invalidTokens);
    }
    if (result.errors > 0) {
      const errMsg = `${result.errors} of ${tokens.length} token(s) failed all inline APNs send attempts`;
      logger.warn({ employeeId, errors: result.errors, total: tokens.length }, `[walletPass] ${errMsg} — queuing for background retry`);
      await recordApnsPushRetry(employeeId, errMsg);
    }
  } catch (err: any) {
    const errMsg = err?.message ?? String(err);
    logger.error({ err, employeeId }, "[walletPass] pushPassUpdateForEmployee failed — queuing for background retry");
    await recordApnsPushRetry(employeeId, errMsg);
  }
}
