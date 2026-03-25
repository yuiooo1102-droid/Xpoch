import { useState, useCallback } from "react";
import type { ServerMessage } from "@xpoch/shared";
import { HexMap } from "./components/HexMap";
import { BattleLog } from "./components/BattleLog";
import { FactionPanel } from "./components/FactionPanel";
import { GameControls } from "./components/GameControls";
import { useGameSocket } from "./hooks/use-game-socket";
import { useGameState } from "./hooks/use-game-state";

export function App() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const { state, updateFromServer } = useGameState();

  const handleMessage = useCallback(
    (msg: ServerMessage) => {
      if (msg.type === "state_update") {
        updateFromServer(msg.state);
      }
    },
    [updateFromServer]
  );

  useGameSocket(sessionId, handleMessage);

  const createSession = async () => {
    const res = await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        factions: [
          { id: "claude", name: "Claude Empire", modelProvider: "mock", color: "#8B5CF6" },
          { id: "gpt", name: "GPT Republic", modelProvider: "mock", color: "#10B981" },
          { id: "gemini", name: "Gemini Dynasty", modelProvider: "mock", color: "#3B82F6" },
        ],
        tickIntervalMs: 3000,
      }),
    });
    const data = await res.json();
    setSessionId(data.sessionId);

    const stateRes = await fetch(`/api/sessions/${data.sessionId}`);
    const stateData = await stateRes.json();
    updateFromServer(stateData.state);
  };

  const winnerFaction = state.winner
    ? state.factions.get(state.winner)
    : undefined;

  return (
    <div className="h-screen flex flex-col">
      <GameControls
        tick={state.tick}
        sessionId={sessionId}
        winner={state.winner}
        factionName={winnerFaction?.name}
        onCreateSession={createSession}
      />

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1">
          <HexMap tiles={state.tiles} factions={state.factions} />
        </div>

        <div className="w-80 border-l border-gray-700 flex flex-col bg-gray-900/50">
          <div className="flex-none">
            <FactionPanel factions={state.factions} tiles={state.tiles} />
          </div>
          <div className="flex-1 border-t border-gray-700 overflow-hidden">
            <BattleLog entries={state.log} />
          </div>
        </div>
      </div>
    </div>
  );
}
