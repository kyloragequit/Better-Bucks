import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod/v4";
import { storage } from "../storage";
import { signTransferToken, verifyTransferToken, hashTransferToken } from "../transferToken";
import { notifyTransferUser } from "../transferWs";
import { pushPassUpdateForEmployee } from "../walletPass";
import { pushGoogleWalletUpdateForEmployee } from "../googleWalletPass";
import { verifyMobileToken } from "./mobile";
import { logger } from "../lib/logger";
import type { User } from "@workspace/db";

// ── Shared auth middleware ─────────────────────────────────────────────────────
// Accepts both web session cookies (req.user from Passport) and mobile JWT
// Bearer tokens so the same endpoints work for both clients.
interface TransferRequest extends Request {
  transferUser: User;
}

async function transferAuth(req: Request, res: Response, next: NextFunction) {
  // 1. Try Passport session
  const sessionUser = (req as any).user as User | undefined;
  if ((req as any).isAuthenticated?.() && sessionUser) {
    (req as TransferRequest).transferUser = sessionUser;
    return next();
  }

  // 2. Try mobile Bearer token
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    const rawId = verifyMobileToken(header.slice(7).trim());
    if (rawId) {
      const user = await storage.getUser(rawId);
      if (user) {
        (req as TransferRequest).transferUser = user;
        return next();
      }
    }
  }

  return res.status(401).json({ message: "Authentication required" });
}

// ── Limit helpers ──────────────────────────────────────────────────────────────
const DEFAULT_PER_TXN = 2000;
const DEFAULT_DAILY = 10000;

async function enforceTransferLimits(
  sender: User,
  amount: number,
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (amount <= 0) return { ok: false, message: "Amount must be positive" };

  const orgId = sender.organizationId ?? 0;

  // Look up limit (user-level, then org-level, then system default)
  const limit = await storage.getTransferLimitForUser(orgId, sender.id);
  const perTxn = limit?.perTxnLimit ?? DEFAULT_PER_TXN;
  const daily = limit?.dailyLimit ?? DEFAULT_DAILY;

  if (amount > perTxn) {
    return { ok: false, message: `Transfer exceeds per-transaction limit of ${perTxn} Bucks` };
  }

  const dailyTotal = await storage.getSenderDailyTotal(sender.id);
  if (dailyTotal + amount > daily) {
    const remaining = Math.max(0, daily - dailyTotal);
    return { ok: false, message: `Daily transfer limit reached. You may send ${remaining} more Bucks today` };
  }

  if (sender.balance < amount) {
    return { ok: false, message: "Insufficient Bucks balance" };
  }

  return { ok: true };
}

// ── Finalise a transfer (shared by nfc/complete, qr/redeem, direct/accept) ────
async function finaliseTransfer(
  transferId: number,
  senderId: number,
  recipientId: number,
  amount: number,
): Promise<void> {
  // Deduct from sender
  await storage.updateUserBalance(senderId, -amount);
  await storage.createTransaction({
    userId: senderId,
    amount: -amount,
    reason: `Bucks transfer sent (transfer #${transferId})`,
    performedBy: senderId,
  });

  // Credit recipient
  await storage.updateUserBalance(recipientId, amount);
  await storage.createTransaction({
    userId: recipientId,
    amount,
    reason: `Bucks transfer received (transfer #${transferId})`,
    performedBy: senderId,
  });

  // Mark transfer completed
  await storage.updateTransferStatus(transferId, {
    status: "completed",
    recipientId,
    completedAt: new Date(),
  });

  // Refresh wallet passes for both parties
  void pushPassUpdateForEmployee(senderId);
  void pushGoogleWalletUpdateForEmployee(senderId);
  void pushPassUpdateForEmployee(recipientId);
  void pushGoogleWalletUpdateForEmployee(recipientId);

  // Real-time balance push via WebSocket
  const [senderAfter, recipientAfter] = await Promise.all([
    storage.getUser(senderId),
    storage.getUser(recipientId),
  ]);
  notifyTransferUser(senderId, {
    type: "balance_updated",
    balance: senderAfter?.balance ?? null,
    transferId,
  });
  notifyTransferUser(recipientId, {
    type: "balance_updated",
    balance: recipientAfter?.balance ?? null,
    transferId,
  });
  notifyTransferUser(recipientId, {
    type: "transfer_received",
    transferId,
    amount,
    senderId,
    senderName: senderAfter?.fullName ?? "Someone",
  });
}

// ── Router ────────────────────────────────────────────────────────────────────
export const transferRouter = Router();
transferRouter.use(transferAuth as any);

// ── NFC: Initiate ─────────────────────────────────────────────────────────────
// Sender generates a short-lived token (60 s) that the recipient scans via NFC.
transferRouter.post("/nfc/initiate", async (req: Request, res: Response) => {
  const user = (req as TransferRequest).transferUser;

  const body = z.object({
    amount: z.number().int().positive(),
    note: z.string().max(200).optional(),
  }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ message: "Invalid request body" });

  const { amount, note } = body.data;

  const check = await enforceTransferLimits(user, amount);
  if (!check.ok) return res.status(400).json({ message: check.message });

  const transfer = await storage.createTransfer({
    senderId: user.id,
    amount,
    method: "nfc",
    note: note ?? null,
    recipientId: null,
  });

  const token = signTransferToken({ tid: transfer.id, s: user.id, r: null, a: amount, m: "nfc" }, 60);
  const tokenHash = hashTransferToken(token);
  await storage.updateTransferStatus(transfer.id, { status: "pending" });

  // Persist the token hash for single-use enforcement
  await storage.updateTransferTokenHash(transfer.id, tokenHash);

  logger.info({ transferId: transfer.id, senderId: user.id, amount }, "[transfer] NFC initiated");
  return res.json({ token, transferId: transfer.id, expiresInSeconds: 60 });
});

// ── NFC: Complete ─────────────────────────────────────────────────────────────
// Recipient presents the token; server validates it and settles the transfer.
transferRouter.post("/nfc/complete", async (req: Request, res: Response) => {
  const recipient = (req as TransferRequest).transferUser;

  const body = z.object({ token: z.string() }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ message: "token is required" });

  const payload = verifyTransferToken(body.data.token);
  if (!payload) return res.status(400).json({ message: "Token is invalid or expired" });
  if (payload.m !== "nfc") return res.status(400).json({ message: "Wrong token type" });
  if (payload.s === recipient.id) return res.status(400).json({ message: "Cannot transfer to yourself" });

  // Single-use check
  const tokenHash = hashTransferToken(body.data.token);
  const existing = await storage.getTransferByTokenHash(tokenHash);
  if (!existing || existing.id !== payload.tid) {
    return res.status(400).json({ message: "Token not found" });
  }
  if (existing.status !== "pending") {
    return res.status(409).json({ message: "Transfer already used or expired" });
  }

  // Same-org check
  const sender = await storage.getUser(payload.s);
  if (!sender) return res.status(400).json({ message: "Sender not found" });
  if (sender.organizationId !== recipient.organizationId) {
    return res.status(403).json({ message: "Transfers must be within the same organisation" });
  }

  // Re-check sender balance at completion time
  if (sender.balance < payload.a) {
    return res.status(400).json({ message: "Sender has insufficient balance" });
  }

  await finaliseTransfer(payload.tid, payload.s, recipient.id, payload.a);

  logger.info({ transferId: payload.tid, senderId: payload.s, recipientId: recipient.id, amount: payload.a }, "[transfer] NFC completed");
  return res.json({ success: true, transferId: payload.tid, amount: payload.a });
});

// ── QR: Generate ─────────────────────────────────────────────────────────────
// Generates a QR-friendly token (5 min TTL) for the sender to display as a QR code.
transferRouter.post("/qr/generate", async (req: Request, res: Response) => {
  const user = (req as TransferRequest).transferUser;

  const body = z.object({
    amount: z.number().int().positive(),
    note: z.string().max(200).optional(),
  }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ message: "Invalid request body" });

  const { amount, note } = body.data;

  const check = await enforceTransferLimits(user, amount);
  if (!check.ok) return res.status(400).json({ message: check.message });

  const transfer = await storage.createTransfer({
    senderId: user.id,
    amount,
    method: "qr",
    note: note ?? null,
    recipientId: null,
  });

  const token = signTransferToken({ tid: transfer.id, s: user.id, r: null, a: amount, m: "qr" }, 300);
  const tokenHash = hashTransferToken(token);
  await storage.updateTransferTokenHash(transfer.id, tokenHash);

  logger.info({ transferId: transfer.id, senderId: user.id, amount }, "[transfer] QR generated");
  return res.json({ token, transferId: transfer.id, expiresInSeconds: 300 });
});

// ── QR: Redeem ────────────────────────────────────────────────────────────────
transferRouter.post("/qr/redeem", async (req: Request, res: Response) => {
  const recipient = (req as TransferRequest).transferUser;

  const body = z.object({ token: z.string() }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ message: "token is required" });

  const payload = verifyTransferToken(body.data.token);
  if (!payload) return res.status(400).json({ message: "Token is invalid or expired" });
  if (payload.m !== "qr") return res.status(400).json({ message: "Wrong token type" });
  if (payload.s === recipient.id) return res.status(400).json({ message: "Cannot transfer to yourself" });

  const tokenHash = hashTransferToken(body.data.token);
  const existing = await storage.getTransferByTokenHash(tokenHash);
  if (!existing || existing.id !== payload.tid) {
    return res.status(400).json({ message: "Token not found" });
  }
  if (existing.status !== "pending") {
    return res.status(409).json({ message: "Transfer already used or expired" });
  }

  const sender = await storage.getUser(payload.s);
  if (!sender) return res.status(400).json({ message: "Sender not found" });
  if (sender.organizationId !== recipient.organizationId) {
    return res.status(403).json({ message: "Transfers must be within the same organisation" });
  }
  if (sender.balance < payload.a) {
    return res.status(400).json({ message: "Sender has insufficient balance" });
  }

  await finaliseTransfer(payload.tid, payload.s, recipient.id, payload.a);

  logger.info({ transferId: payload.tid, senderId: payload.s, recipientId: recipient.id, amount: payload.a }, "[transfer] QR redeemed");
  return res.json({ success: true, transferId: payload.tid, amount: payload.a });
});

// ── Direct: Send ─────────────────────────────────────────────────────────────
// Initiates a direct transfer to a named recipient. Creates a pending request
// that the recipient must explicitly accept.
transferRouter.post("/direct/send", async (req: Request, res: Response) => {
  const sender = (req as TransferRequest).transferUser;

  const body = z.object({
    recipientUsername: z.string(),
    amount: z.number().int().positive(),
    note: z.string().max(200).optional(),
  }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ message: "recipientUsername and amount are required" });

  const { recipientUsername, amount, note } = body.data;

  if (sender.organizationId == null) {
    return res.status(400).json({ message: "Sender has no organisation" });
  }

  const recipient = await storage.getUserByUsernameAndOrg(recipientUsername, sender.organizationId);
  if (!recipient) {
    return res.status(404).json({ message: "Recipient not found in your organisation" });
  }
  if (recipient.id === sender.id) {
    return res.status(400).json({ message: "Cannot transfer to yourself" });
  }

  const check = await enforceTransferLimits(sender, amount);
  if (!check.ok) return res.status(400).json({ message: check.message });

  const transfer = await storage.createTransfer({
    senderId: sender.id,
    recipientId: recipient.id,
    amount,
    method: "direct",
    note: note ?? null,
  });

  // Token (1 hour TTL) embeds both parties — used for accept/decline auth
  const token = signTransferToken(
    { tid: transfer.id, s: sender.id, r: recipient.id, a: amount, m: "direct" },
    3600,
  );
  const tokenHash = hashTransferToken(token);
  await storage.updateTransferTokenHash(transfer.id, tokenHash);

  // Notify recipient in real time
  notifyTransferUser(recipient.id, {
    type: "transfer_received",
    transferId: transfer.id,
    amount,
    senderId: sender.id,
    senderName: sender.fullName,
    note: note ?? null,
  });

  logger.info({ transferId: transfer.id, senderId: sender.id, recipientId: recipient.id, amount }, "[transfer] direct send");
  return res.json({ transferId: transfer.id, token, recipientId: recipient.id, recipientName: recipient.fullName });
});

// ── Direct: Accept ────────────────────────────────────────────────────────────
transferRouter.post("/direct/accept", async (req: Request, res: Response) => {
  const recipient = (req as TransferRequest).transferUser;

  const body = z.object({ transferId: z.number().int().positive() }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ message: "transferId is required" });

  const transfer = await storage.getTransfer(body.data.transferId);
  if (!transfer) return res.status(404).json({ message: "Transfer not found" });
  if (transfer.recipientId !== recipient.id) return res.status(403).json({ message: "Not your transfer" });
  if (transfer.status !== "pending") {
    return res.status(409).json({ message: `Transfer is already ${transfer.status}` });
  }

  const sender = await storage.getUser(transfer.senderId);
  if (!sender) return res.status(400).json({ message: "Sender not found" });
  if (sender.balance < transfer.amount) {
    return res.status(400).json({ message: "Sender no longer has sufficient balance" });
  }

  await finaliseTransfer(transfer.id, transfer.senderId, recipient.id, transfer.amount);

  logger.info({ transferId: transfer.id, recipientId: recipient.id, amount: transfer.amount }, "[transfer] direct accepted");
  return res.json({ success: true, transferId: transfer.id, amount: transfer.amount });
});

// ── Direct: Decline ───────────────────────────────────────────────────────────
transferRouter.post("/direct/decline", async (req: Request, res: Response) => {
  const recipient = (req as TransferRequest).transferUser;

  const body = z.object({ transferId: z.number().int().positive() }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ message: "transferId is required" });

  const transfer = await storage.getTransfer(body.data.transferId);
  if (!transfer) return res.status(404).json({ message: "Transfer not found" });
  if (transfer.recipientId !== recipient.id) return res.status(403).json({ message: "Not your transfer" });
  if (transfer.status !== "pending") {
    return res.status(409).json({ message: `Transfer is already ${transfer.status}` });
  }

  await storage.updateTransferStatus(transfer.id, { status: "declined" });

  // Notify sender of decline
  notifyTransferUser(transfer.senderId, {
    type: "transfer_declined",
    transferId: transfer.id,
    recipientId: recipient.id,
    recipientName: recipient.fullName,
  });

  logger.info({ transferId: transfer.id, recipientId: recipient.id }, "[transfer] direct declined");
  return res.json({ success: true, transferId: transfer.id });
});

// ── History ───────────────────────────────────────────────────────────────────
transferRouter.get("/history", async (req: Request, res: Response) => {
  const user = (req as TransferRequest).transferUser;
  const limit = Math.min(Number(req.query.limit ?? 50), 200);
  const history = await storage.getTransferHistory(user.id, limit);
  return res.json(history);
});
