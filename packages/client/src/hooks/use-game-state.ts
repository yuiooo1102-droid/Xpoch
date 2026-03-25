import { useState, useCallback } from "react";
import type { Tile, Faction, Unit, City, Wonder, LogEntry } from "@xpoch/shared";

export interface ClientGameState {
  readonly tick: number;
  readonly tiles: ReadonlyMap<string, Tile>;
  readonly units: ReadonlyMap<string, Unit>;
  readonly cities: ReadonlyMap<string, City>;
  readonly factions: ReadonlyMap<string, Faction>;
  readonly wonders: readonly Wonder[];
  readonly log: readonly LogEntry[];
  readonly winner: string | null;
}

const EMPTY_STATE: ClientGameState = {
  tick: 0,
  tiles: new Map(),
  units: new Map(),
  cities: new Map(),
  factions: new Map(),
  wonders: [],
  log: [],
  winner: null,
};

function toMap<V>(raw: unknown): ReadonlyMap<string, V> {
  if (raw == null || typeof raw !== "object") return new Map();
  return new Map(Object.entries(raw as Record<string, V>));
}

export function useGameState() {
  const [state, setState] = useState<ClientGameState>(EMPTY_STATE);

  const updateFromServer = useCallback((raw: any) => {
    setState({
      tick: raw.tick ?? 0,
      tiles: toMap<Tile>(raw.tiles),
      units: toMap<Unit>(raw.units),
      cities: toMap<City>(raw.cities),
      factions: toMap<Faction>(raw.factions),
      wonders: Array.isArray(raw.wonders) ? raw.wonders : [],
      log: Array.isArray(raw.log) ? raw.log : [],
      winner: raw.winner ?? null,
    });
  }, []);

  return { state, updateFromServer };
}
