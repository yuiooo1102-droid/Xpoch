import { Router } from "express";
import type { SessionManager } from "./session-manager";
import type { WsHandler } from "./ws-handler";
import { createAdapter, PROVIDERS } from "@xpoch/ai-adapter";
import type { PlayerConfig } from "@xpoch/ai-adapter";
import { TICK_INTERVAL_MS } from "@xpoch/shared";
import type { FactionConfig } from "@xpoch/engine";

export function createApiRoutes(
  sessionManager: SessionManager,
  wsHandler: WsHandler
): Router {
  const router = Router();

  // List available AI providers
  router.get("/providers", (_req, res) => {
    res.json(PROVIDERS.map((p) => ({
      id: p.id,
      name: p.name,
      defaultModel: p.defaultModel,
    })));
  });

  router.get("/sessions", (_req, res) => {
    res.json(sessionManager.listSessions());
  });

  router.post("/sessions", (req, res) => {
    const players: PlayerConfig[] = req.body.players ?? [
      { name: "Claude Empire", modelProvider: "anthropic", color: "#8B5CF6" },
      { name: "GPT Republic", modelProvider: "openai", color: "#10B981" },
      { name: "Gemini Dynasty", modelProvider: "gemini", color: "#3B82F6" },
    ];

    const factionConfigs: FactionConfig[] = players.map((p, i) => ({
      id: `faction_${i}`,
      name: p.name,
      modelProvider: p.modelProvider,
      color: (req.body.players?.[i]?.color) ?? ["#8B5CF6", "#10B981", "#3B82F6", "#F59E0B", "#EF4444", "#EC4899"][i % 6],
    }));

    const session = sessionManager.createSession(
      factionConfigs,
      (config) => {
        const playerConfig = players.find((p) => p.name === config.name);
        return createAdapter({
          modelProvider: config.modelProvider,
          apiKey: playerConfig?.apiKey,
          model: playerConfig?.model,
          name: config.name,
        });
      },
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
