import forge from "node-forge";
import { storage } from "./storage";

export class GoogleWalletConfigError extends Error {}

const GOOGLE_WALLET_SAVE_URL = "https://pay.google.com/gp/v/save";

function getGoogleWalletEnv() {
  const issuerId = process.env.GOOGLE_WALLET_ISSUER_ID;
  const classId = process.env.GOOGLE_WALLET_CLASS_ID;
  const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKeyPem = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

  if (!issuerId || !classId || !serviceAccountEmail || !privateKeyPem) {
    const missing = [
      !issuerId && "GOOGLE_WALLET_ISSUER_ID",
      !classId && "GOOGLE_WALLET_CLASS_ID",
      !serviceAccountEmail && "GOOGLE_SERVICE_ACCOUNT_EMAIL",
      !privateKeyPem && "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY",
    ]
      .filter(Boolean)
      .join(", ");
    throw new GoogleWalletConfigError(
      `Google Wallet is not configured. Missing secret(s): ${missing}. Ask your administrator to add them in Replit Secrets.`,
    );
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
