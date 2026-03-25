import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";
import type { GameState, ServerMessage, ClientMessage } from "@xpoch/shared";

export class WsHandler {
  private wss: WebSocketServer;
  private subscriptions = new Map<string, Set<WebSocket>>();

  constructor(server: Server) {
    this.wss = new WebSocketServer({ server, path: "/ws" });

    this.wss.on("connection", (ws) => {
      ws.on("message", (data) => {
        try {
          const msg: ClientMessage = JSON.parse(data.toString());
          this.handleMessage(ws, msg);
        } catch {
          // ignore malformed messages
        }
      });

      ws.on("close", () => {
        for (const clients of this.subscriptions.values()) {
          clients.delete(ws);
        }
      });
    });
  }

  private handleMessage(ws: WebSocket, msg: ClientMessage): void {
    switch (msg.type) {
      case "subscribe": {
        const clients = this.subscriptions.get(msg.sessionId) ?? new Set();
        clients.add(ws);
        this.subscriptions.set(msg.sessionId, clients);
        break;
      }
      case "unsubscribe": {
        for (const clients of this.subscriptions.values()) {
          clients.delete(ws);
        }
        break;
      }
    }
  }

  broadcastState(sessionId: string, state: GameState): void {
    const clients = this.subscriptions.get(sessionId);
    if (!clients) return;

    const msg: ServerMessage = { type: "state_update", state: serializeState(state) as GameState };
    const payload = JSON.stringify(msg);

    for (const ws of clients) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
      }
    }
  }
}

function serializeState(state: GameState): object {
  return {
    ...state,
    tiles: Object.fromEntries(state.tiles),
    factions: Object.fromEntries(state.factions),
    diplomacy: {
      relations: Object.fromEntries(state.diplomacy.relations),
    },
  };
}
