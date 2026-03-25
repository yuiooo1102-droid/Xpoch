import { useState, useCallback } from "react";
import type { Tile, Faction, LogEntry } from "@xpoch/shared";

interface ClientGameState {
  readonly tick: number;
  readonly tiles: ReadonlyMap<string, Tile>;
  readonly factions: ReadonlyMap<string, Faction>;
  readonly log: readonly LogEntry[];
  readonly winner: string | null;
}

const EMPTY_STATE: ClientGameState = {
  tick: 0,
  tiles: new Map(),
  factions: new Map(),
  log: [],
  winner: null,
};

export function useGameState() {
  const [state, setState] = useState<ClientGameState>(EMPTY_STATE);

  const updateFromServer = useCallback((raw: any) => {
    setState({
      tick: raw.tick ?? 0,
      tiles: new Map(Object.entries(raw.tiles ?? {})),
      factions: new Map(Object.entries(raw.factions ?? {})),
      log: raw.log ?? [],
      winner: raw.winner ?? null,
    });
  }, []);

  return { state, updateFromServer };
}
