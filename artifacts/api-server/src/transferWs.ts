import { WebSocketServer, WebSocket } from "ws";
import type { IncomingMessage } from "http";
import type { Server } from "http";
import { URL } from "url";
import { verifyMobileToken } from "./routes/mobile";
import { storage } from "./storage";
import { logger } from "./lib/logger";

// userId → set of active WebSocket connections (user may have multiple tabs/devices)
const userSockets = new Map<number, Set<WebSocket>>();

/**
 * Broadcast a JSON event to every open WebSocket connection for the given user.
 * Safe to call even when the user has no connected sockets.
 */
export function notifyTransferUser(userId: number, payload: object): void {
  const sockets = userSockets.get(userId);
  if (!sockets || sockets.size === 0) return;
  const msg = JSON.stringify(payload);
  for (const ws of sockets) {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(msg);
      } catch (err) {
        logger.warn({ err, userId }, "[transferWs] send error");
      }
    }
  }
}

/**
 * Attach the transfer WebSocket server to the HTTP server.
 * Clients connect to /api/transfers/ws?token=<mobile-jwt>
 * Web-session users are not supported over WS (cookies are not sent on WS upgrades
 * in cross-origin Replit preview contexts), so the mobile JWT is always required.
 */
export function initTransferWs(httpServer: Server): void {
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on("upgrade", (req: IncomingMessage, socket, head) => {
    const url = req.url ?? "";
    if (!url.startsWith("/api/transfers/ws")) return;
    wss.handleUpgrade(req, socket as any, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  });

  wss.on("connection", async (ws: WebSocket, req: IncomingMessage) => {
    let userId: number | null = null;

    try {
      const u = new URL(req.url ?? "", "http://localhost");
      const token = u.searchParams.get("token");
      if (token) {
        const rawId = verifyMobileToken(token);
        if (rawId) {
          const user = await storage.getUser(rawId);
          if (user) userId = user.id;
        }
      }
    } catch {
      // ignore parse errors
    }

    if (!userId) {
      ws.close(1008, "Unauthorized");
      return;
    }

    const uid = userId;

    if (!userSockets.has(uid)) userSockets.set(uid, new Set());
    userSockets.get(uid)!.add(ws);

    logger.debug({ userId: uid }, "[transferWs] client connected");

    ws.send(JSON.stringify({ type: "connected", userId: uid }));

    ws.on("close", () => {
      const sockets = userSockets.get(uid);
      if (sockets) {
        sockets.delete(ws);
        if (sockets.size === 0) userSockets.delete(uid);
      }
      logger.debug({ userId: uid }, "[transferWs] client disconnected");
    });

    ws.on("error", (err) => {
      logger.warn({ err, userId: uid }, "[transferWs] socket error");
    });
  });

  logger.info("[transferWs] WebSocket hub attached at /api/transfers/ws");
}
