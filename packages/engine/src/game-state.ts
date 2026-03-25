import type {
  GameState,
  Faction,
  FactionId,
  Tile,
  HexCoord,
  DiplomacyState,
} from "@xpoch/shared";
import { hexKey, hexDisk, hexDistance } from "@xpoch/shared";
import { generateMap } from "./map-generator";

export interface FactionConfig {
  readonly id: FactionId;
  readonly name: string;
  readonly modelProvider: string;
  readonly color: string;
}

const STARTING_GOLD = 100;
const STARTING_FOOD = 50;
const STARTING_ARMY = 10;

export function createInitialState(
  mapRadius: number,
  seed: number,
  factionConfigs: readonly FactionConfig[]
): GameState {
  const baseTiles = generateMap(mapRadius, seed);
  const tiles = new Map(baseTiles);

  const factions = new Map<FactionId, Faction>();
  const spawnCoords = pickSpawnPositions(mapRadius, factionConfigs.length);

  for (let i = 0; i < factionConfigs.length; i++) {
    const cfg = factionConfigs[i];
    const spawn = spawnCoords[i];

    factions.set(cfg.id, {
      id: cfg.id,
      name: cfg.name,
      modelProvider: cfg.modelProvider,
      color: cfg.color,
      gold: STARTING_GOLD,
      food: STARTING_FOOD,
      alive: true,
    });

    const key = hexKey(spawn);
    const existing = tiles.get(key);
    if (existing) {
      tiles.set(key, {
        ...existing,
        terrain: "plains",
        owner: cfg.id,
        army: STARTING_ARMY,
      });
    }
  }

  const diplomacy: DiplomacyState = { relations: new Map() };

  return {
    tick: 0,
    tiles,
    factions,
    diplomacy,
    log: [],
    winner: null,
    mapSize: mapRadius,
  };
}

function pickSpawnPositions(
  mapRadius: number,
  count: number
): HexCoord[] {
  const spawnRadius = Math.max(1, Math.floor(mapRadius * 0.7));
  const ring = hexDisk({ q: 0, r: 0 }, spawnRadius).filter(
    (c) => hexDistance(c, { q: 0, r: 0 }) === spawnRadius
  );

  const step = Math.max(1, Math.floor(ring.length / count));
  return Array.from({ length: count }, (_, i) => ring[(i * step) % ring.length]);
}

export function getTile(
  state: GameState,
  coord: HexCoord
): Tile | undefined {
  return state.tiles.get(hexKey(coord));
}

export function getFaction(
  state: GameState,
  factionId: FactionId
): Faction | undefined {
  return state.factions.get(factionId);
}

export function setTileOwner(
  state: GameState,
  coord: HexCoord,
  owner: FactionId | null,
  army: number
): GameState {
  const key = hexKey(coord);
  const tile = state.tiles.get(key);
  if (!tile) return state;

  const newTiles = new Map(state.tiles);
  newTiles.set(key, { ...tile, owner, army });

  return { ...state, tiles: newTiles };
}

export function updateFaction(
  state: GameState,
  factionId: FactionId,
  updates: Partial<Omit<Faction, "id">>
): GameState {
  const faction = state.factions.get(factionId);
  if (!faction) return state;

  const newFactions = new Map(state.factions);
  newFactions.set(factionId, { ...faction, ...updates });

  return { ...state, factions: newFactions };
}

export function addLogEntry(
  state: GameState,
  message: string,
  involvedFactions: FactionId[]
): GameState {
  return {
    ...state,
    log: [
      ...state.log,
      { tick: state.tick, message, involvedFactions },
    ],
  };
}

export function advanceTick(state: GameState): GameState {
  return { ...state, tick: state.tick + 1 };
}
