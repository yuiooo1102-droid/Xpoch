import { useEffect, useRef, useCallback } from "react";
import type { ServerMessage } from "@xpoch/shared";

export function useGameSocket(
  sessionId: string | null,
  onMessage: (msg: ServerMessage) => void
) {
  const wsRef = useRef<WebSocket | null>(null);

  const connect = useCallback(() => {
    if (!sessionId) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "subscribe", sessionId }));
    };

    ws.onmessage = (event) => {
      try {
        const msg: ServerMessage = JSON.parse(event.data);
        onMessage(msg);
      } catch {
        // ignore
      }
    };

    ws.onclose = () => {
      setTimeout(connect, 2000);
    };

    wsRef.current = ws;
  }, [sessionId, onMessage]);

  useEffect(() => {
    connect();
    return () => wsRef.current?.close();
  }, [connect]);
}
