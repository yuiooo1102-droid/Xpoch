import { Router } from "express";
import type { SessionManager } from "./session-manager";
import type { WsHandler } from "./ws-handler";
import { MockAdapter } from "@xpoch/ai-adapter";
import { TICK_INTERVAL_MS } from "@xpoch/shared";
import type { FactionConfig } from "@xpoch/engine";

export function createApiRoutes(
  sessionManager: SessionManager,
  wsHandler: WsHandler
): Router {
  const router = Router();

  router.get("/sessions", (_req, res) => {
    res.json(sessionManager.listSessions());
  });

  router.post("/sessions", (req, res) => {
    const factionConfigs: FactionConfig[] = req.body.factions ?? [
      { id: "claude", name: "Claude Empire", modelProvider: "mock", color: "#8B5CF6" },
      { id: "gpt", name: "GPT Republic", modelProvider: "mock", color: "#10B981" },
      { id: "gemini", name: "Gemini Dynasty", modelProvider: "mock", color: "#3B82F6" },
    ];

    const session = sessionManager.createSession(
      factionConfigs,
      () => new MockAdapter(),
      (sessionId, state) => wsHandler.broadcastState(sessionId, state)
    );

    const tickInterval = req.body.tickIntervalMs ?? TICK_INTERVAL_MS;
    session.loop.start(tickInterval);

    res.status(201).json({ sessionId: session.id });
  });

  router.get("/sessions/:id", (req, res) => {
    const session = sessionManager.getSession(req.params.id);
    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }
    const state = session.loop.getState();
    res.json({
      id: session.id,
      running: session.loop.isRunning(),
      state: {
        ...state,
        tiles: Object.fromEntries(state.tiles),
        factions: Object.fromEntries(state.factions),
        diplomacy: { relations: Object.fromEntries(state.diplomacy.relations) },
      },
    });
  });

  router.post("/sessions/:id/stop", (req, res) => {
    const session = sessionManager.getSession(req.params.id);
    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }
    session.loop.stop();
    res.json({ stopped: true });
  });

  router.delete("/sessions/:id", (req, res) => {
    const deleted = sessionManager.deleteSession(req.params.id);
    res.json({ deleted });
  });

  return router;
}
