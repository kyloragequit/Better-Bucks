import { useEffect, useRef, useCallback } from "react";
import { API_URL } from "@/constants/api";
import { useAuth } from "@/contexts/AuthContext";

export type TransferWsEvent =
  | { type: "connected"; userId: number }
  | { type: "balance_updated"; balance: number; transferId: number }
  | { type: "transfer_received"; transferId: number; amount: number; senderId: number; senderName: string; note?: string | null }
  | { type: "transfer_declined"; transferId: number; recipientId: number; recipientName: string };

/**
 * Connects to the transfer WebSocket hub at /api/transfers/ws.
 * Fires `onEvent` for each message received.
 * Automatically disconnects on unmount.
 */
export function useTransferWs(onEvent: (event: TransferWsEvent) => void) {
  const { token } = useAuth();
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!token || !API_URL) return;

    const wsBase = API_URL
      .replace(/^http:/, "ws:")
      .replace(/^https:/, "wss:")
      .replace(/\/+$/, "");

    let ws: WebSocket;
    try {
      ws = new WebSocket(`${wsBase}/api/transfers/ws?token=${encodeURIComponent(token)}`);
    } catch {
      return;
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data as string) as TransferWsEvent;
        onEventRef.current(data);
      } catch {
        // ignore malformed messages
      }
    };

    // Ignore errors and close events — no reconnect logic needed here;
    // the user can re-navigate to reconnect.
    ws.onerror = () => {};
    ws.onclose = () => {};

    return () => {
      ws.close();
    };
  }, [token]);
}
