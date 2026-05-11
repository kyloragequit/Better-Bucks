import forge from "node-forge";
import { storage } from "./storage";
import { logger } from "./lib/logger";

export class GoogleWalletConfigError extends Error {}

const GOOGLE_WALLET_SAVE_URL = "https://pay.google.com/gp/v/save";
const GOOGLE_WALLET_API_BASE = "https://walletobjects.googleapis.com/walletobjects/v1";
const GOOGLE_OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_WALLET_SCOPE = "https://www.googleapis.com/auth/wallet_object.issuer";

function getGoogleWalletEnv() {
  const issuerId = process.env.GOOGLE_WALLET_ISSUER_ID;
  const classId = process.env.GOOGLE_WALLET_CLASS_ID;
  const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKeyRaw = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

  if (!issuerId || !classId || !serviceAccountEmail || !privateKeyRaw) {
    const missing = [
      !issuerId && "GOOGLE_WALLET_ISSUER_ID",
      !classId && "GOOGLE_WALLET_CLASS_ID",
      !serviceAccountEmail && "GOOGLE_SERVICE_ACCOUNT_EMAIL",
      !privateKeyRaw && "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY",
    ]
      .filter(Boolean)
      .join(", ");
    throw new GoogleWalletConfigError(
      `Google Wallet is not configured. Missing secret(s): ${missing}. Ask your administrator to add them in Replit Secrets.`,
    );
  }

  // Accept the private key as a raw PEM string or as a base64-encoded PEM.
  // Also replace literal \n sequences with real newlines — common when copying
  // a multi-line key into a single-line environment variable.
  let privateKeyPem: string;
  if (privateKeyRaw.trimStart().startsWith("-----BEGIN")) {
    privateKeyPem = privateKeyRaw.replace(/\\n/g, "\n");
  } else {
    // Assume base64-encoded PEM
    privateKeyPem = Buffer.from(privateKeyRaw, "base64").toString("utf-8");
  }

  return { issuerId, classId, serviceAccountEmail, privateKeyPem };
}

function base64url(input: string | forge.util.ByteStringBuffer): string {
  const str =
    typeof input === "string"
      ? input
      : input.bytes();
  return Buffer.from(str, "binary")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

function signRS256(data: string, privateKeyPem: string): string {
  const privateKey = forge.pki.privateKeyFromPem(privateKeyPem);
  const md = forge.md.sha256.create();
  md.update(data, "utf8");
  const signature = (privateKey as forge.pki.rsa.PrivateKey).sign(md);
  return base64url(forge.util.createBuffer(signature));
}

function buildJwt(payload: object, serviceAccountEmail: string, privateKeyPem: string): string {
  const header = { alg: "RS256", typ: "JWT" };
  const headerB64 = base64url(JSON.stringify(header));
  const payloadB64 = base64url(JSON.stringify(payload));
  const signingInput = `${headerB64}.${payloadB64}`;
  const signature = signRS256(signingInput, privateKeyPem);
  return `${signingInput}.${signature}`;
}

/** Obtain a short-lived OAuth2 access token for the Google Wallet API using
 *  service-account JWT bearer flow (no external googleapis library required). */
async function getServiceAccountAccessToken(
  serviceAccountEmail: string,
  privateKeyPem: string,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const jwtPayload = {
    iss: serviceAccountEmail,
    sub: serviceAccountEmail,
    aud: GOOGLE_OAUTH_TOKEN_URL,
    scope: GOOGLE_WALLET_SCOPE,
    iat: now,
    exp: now + 3600,
  };
  const jwt = buildJwt(jwtPayload, serviceAccountEmail, privateKeyPem);

  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion: jwt,
  });

  const response = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "(no body)");
    throw new Error(`Google OAuth token exchange failed (${response.status}): ${text}`);
  }

  const json = (await response.json()) as { access_token?: string };
  if (!json.access_token) {
    throw new Error("Google OAuth response missing access_token");
  }
  return json.access_token;
}

export async function buildGoogleWalletSaveUrl(employeeId: number): Promise<string> {
  const env = getGoogleWalletEnv();

  const employee = await storage.getUser(employeeId);
  if (!employee) throw new Error("Employee not found");

  const org = employee.organizationId
    ? await storage.getOrganization(employee.organizationId)
    : null;

  const now = Math.floor(Date.now() / 1000);
  const objectSuffix = `employee-${employeeId}`;
  const objectId = `${env.issuerId}.${objectSuffix}`;
  const fullClassId = `${env.issuerId}.${env.classId}`;

  const genericObject = {
    id: objectId,
    classId: fullClassId,
    genericType: "GENERIC_TYPE_UNSPECIFIED",
    hexBackgroundColor: "#162A4A",
    logo: {
      sourceUri: {
        uri: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/53/Google_%22G%22_Logo.svg/32px-Google_%22G%22_Logo.svg.png",
      },
    },
    cardTitle: {
      defaultValue: { language: "en-US", value: org?.name ?? "Better Bucks" },
    },
    header: {
      defaultValue: {
        language: "en-US",
        value: employee.fullName || employee.email || "Member",
      },
    },
    subheader: {
      defaultValue: { language: "en-US", value: "Bucks Balance" },
    },
    textModulesData: [
      {
        id: "balance",
        header: "Current Balance",
        body: `${employee.balance ?? 0} Bucks`,
      },
      {
        id: "workplace",
        header: "Workplace",
        body: org?.name ?? "Better Bucks",
      },
    ],
    barcode: {
      type: "QR_CODE",
      value: `BB-EMP-${employeeId}`,
      alternateText: "Better Bucks Member",
    },
    state: "ACTIVE",
  };

  const jwtPayload = {
    iss: env.serviceAccountEmail,
    sub: env.serviceAccountEmail,
    aud: "google",
    iat: now,
    typ: "savetowallet",
    payload: {
      genericObjects: [genericObject],
    },
  };

  const jwt = buildJwt(jwtPayload, env.serviceAccountEmail, env.privateKeyPem);
  return `${GOOGLE_WALLET_SAVE_URL}/${jwt}`;
}

/** Push an updated Bucks balance to the employee's existing Google Wallet pass object.
 *
 *  Uses the Google Wallet Objects REST API (PATCH) so Android employees see the live
 *  balance without re-adding the card. This mirrors the Apple Wallet APNs push for iOS.
 *
 *  - No-op if Google Wallet env vars are not configured (GoogleWalletConfigError is swallowed).
 *  - Any other errors are logged but never propagated so a push failure never breaks a
 *    balance update. */
export async function pushGoogleWalletUpdateForEmployee(employeeId: number): Promise<void> {
  try {
    const env = getGoogleWalletEnv();

    const employee = await storage.getUser(employeeId);
    if (!employee) return;

    const org = employee.organizationId
      ? await storage.getOrganization(employee.organizationId)
      : null;

    const objectId = `${env.issuerId}.employee-${employeeId}`;

    const accessToken = await getServiceAccountAccessToken(
      env.serviceAccountEmail,
      env.privateKeyPem,
    );

    // Send the full textModulesData array on every PATCH so that Google Wallet's
    // array-replace semantics never silently drop the "workplace" module.
    const patchBody = {
      textModulesData: [
        {
          id: "balance",
          header: "Current Balance",
          body: `${employee.balance ?? 0} Bucks`,
        },
        {
          id: "workplace",
          header: "Workplace",
          body: org?.name ?? "Better Bucks",
        },
      ],
    };

    const url = `${GOOGLE_WALLET_API_BASE}/genericObject/${encodeURIComponent(objectId)}`;
    const response = await fetch(url, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(patchBody),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "(no body)");
      if (response.status === 404) {
        logger.info(
          { employeeId, objectId },
          "[googleWalletPass] Object not found — employee has not added the card yet, skipping update",
        );
        return;
      }
      throw new Error(`Google Wallet PATCH failed (${response.status}): ${text}`);
    }

    logger.info({ employeeId }, "[googleWalletPass] Google Wallet pass updated successfully");
  } catch (err: any) {
    if (err instanceof GoogleWalletConfigError) {
      return;
    }
    logger.error({ err, employeeId }, "[googleWalletPass] pushGoogleWalletUpdateForEmployee failed");
  }
}
