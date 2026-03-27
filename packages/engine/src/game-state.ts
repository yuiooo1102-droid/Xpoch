import type {
  GameState,
  Faction,
  FactionId,
  Tile,
  HexCoord,
  DiplomacyState,
  Army,
  ArmyId,
  General,
  GeneralId,
  City,
  CityId,
  LogEntry,
  HistoricalFaction,
  GeneralDef,
} from "@xpoch/shared";
import {
  hexKey,
  hexDisk,
  hexDistance,
  hexNeighbors,
  STARTING_RESOURCES,
  STARTING_GARRISON,
  STARTING_ARMY_TROOPS,
  GENERAL_POOL,
  GENERALS_PER_FACTION,
  CITY_NAMES,
} from "@xpoch/shared";
import { generateMap } from "./map-generator";

// === Public types ===

export interface FactionConfig {
  readonly id: FactionId;
  readonly name: string;
  readonly modelProvider: string;
  readonly color: string;
  readonly historicalFaction?: HistoricalFaction;
}

// === Helpers ===

let armyCounter = 0;
let cityCounter = 0;

/** Reset counters (useful for deterministic tests) */
export function _resetCounters(): void {
  armyCounter = 0;
  cityCounter = 0;
}

export function nextArmyId(factionId: FactionId): ArmyId {
  armyCounter += 1;
  return `${factionId}-army-${armyCounter}`;
}

function nextCityId(factionId: FactionId): CityId {
  cityCounter += 1;
  return `${factionId}-city-${cityCounter}`;
}

function createRng(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickSpawnPositions(
  mapRadius: number,
  count: number,
): HexCoord[] {
  const spawnRadius = Math.max(1, Math.floor(mapRadius * 0.7));
  const ring = hexDisk({ q: 0, r: 0 }, spawnRadius).filter(
    (c) => hexDistance(c, { q: 0, r: 0 }) === spawnRadius,
  );

  const step = Math.max(1, Math.floor(ring.length / count));
  return Array.from({ length: count }, (_, i) => ring[(i * step) % ring.length]);
}

/**
 * Shuffle an array using Fisher-Yates with the provided RNG.
 * Returns a new array (does not mutate).
 */
function shuffle<T>(arr: readonly T[], rng: () => number): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = result[i];
    result[i] = result[j];
    result[j] = tmp;
  }
  return result;
}

/**
 * Assign generals to factions, preferring historical alignment.
 * Each faction first gets generals matching its historicalFaction,
 * then fills remaining slots from the unassigned pool.
 */
function assignHistoricalGenerals(
  factionConfigs: readonly FactionConfig[],
  generalsPerFaction: number,
  rng: () => number,
): ReadonlyMap<FactionId, readonly GeneralDef[]> {
  const assigned = new Set<string>();
  const result = new Map<FactionId, readonly GeneralDef[]>();

  // First pass: assign historical generals to matching factions
  for (const cfg of factionConfigs) {
    const hf = cfg.historicalFaction;
    if (!hf) continue;

    const matching = GENERAL_POOL.filter(
      (g) => g.historicalFaction === hf && !assigned.has(g.id),
    );
    const shuffled = shuffle(matching, rng);
    const picked = shuffled.slice(0, generalsPerFaction);
    for (const g of picked) {
      assigned.add(g.id);
    }
    result.set(cfg.id, picked);
  }

  // Second pass: fill remaining slots from unassigned pool
  const remaining = shuffle(
    GENERAL_POOL.filter((g) => !assigned.has(g.id)),
    rng,
  );
  let remainingIdx = 0;

  for (const cfg of factionConfigs) {
    const current = result.get(cfg.id) ?? [];
    const needed = generalsPerFaction - current.length;
    if (needed <= 0) continue;

    const extras = remaining.slice(remainingIdx, remainingIdx + needed);
    remainingIdx += needed;
    for (const g of extras) {
      assigned.add(g.id);
    }
    result.set(cfg.id, [...current, ...extras]);
  }

  return result;
}

/**
 * Get a themed city name based on historical faction and city index.
 */
function getCityName(
  historicalFaction: HistoricalFaction | undefined,
  cityIndex: number,
  isCapital: boolean,
): string {
  const hf = historicalFaction ?? "neutral";
  const names = CITY_NAMES[hf];
  if (isCapital) return names[0];
  const idx = Math.min(cityIndex, names.length - 1);
  return names[idx] ?? names[0];
}

// === State creation ===

export function createInitialState(
  mapRadius: number,
  seed: number,
  factionConfigs: readonly FactionConfig[],
): GameState {
  _resetCounters();

  const rng = createRng(seed + 9999); // offset from map seed
  const baseTiles = generateMap(mapRadius, seed);
  const tiles = new Map(baseTiles);
  const factions = new Map<FactionId, Faction>();
  const armies = new Map<ArmyId, Army>();
  const generals = new Map<GeneralId, General>();
  const cities = new Map<CityId, City>();
  const spawnCoords = pickSpawnPositions(mapRadius, factionConfigs.length);

  // Assign generals with historical faction preference
  const factionGeneralMap = assignHistoricalGenerals(
    factionConfigs,
    GENERALS_PER_FACTION,
    rng,
  );

  for (let i = 0; i < factionConfigs.length; i++) {
    const cfg = factionConfigs[i];
    const spawn = spawnCoords[i];

    // Assign generals
    const factionGeneralDefs = factionGeneralMap.get(cfg.id) ?? [];

    for (const genDef of factionGeneralDefs) {
      const general: General = {
        id: genDef.id,
        defId: genDef.id,
        factionId: cfg.id,
        name: genDef.name,
        level: 1,
        exp: 0,
        alive: true,
        respawnTick: null,
      };
      generals.set(general.id, general);
    }

    // Create capital city with themed name
    const cityId = nextCityId(cfg.id);
    const capitalName = getCityName(cfg.historicalFaction, 0, true);
    cities.set(cityId, {
      id: cityId,
      factionId: cfg.id,
      name: capitalName,
      coord: spawn,
      isCapital: true,
      level: 1,
      walls: 0,
      garrison: { ...STARTING_GARRISON },
      trainingQueue: null,
    });

    // Ensure city center tile is land and assign to faction + city
    const spawnKey = hexKey(spawn);
    const existingCenter = tiles.get(spawnKey);
    if (existingCenter) {
      tiles.set(spawnKey, {
        ...existingCenter,
        terrain: existingCenter.terrain === "water" ? "plains" : existingCenter.terrain,
        owner: cfg.id,
        cityId,
      });
    }

    // Mark 6 surrounding tiles as owned by faction (initial territory)
    const neighbors = hexNeighbors(spawn);
    for (const nb of neighbors) {
      const nbKey = hexKey(nb);
      const nbTile = tiles.get(nbKey);
      if (nbTile) {
        tiles.set(nbKey, {
          ...nbTile,
          terrain: nbTile.terrain === "water" ? "plains" : nbTile.terrain,
          owner: cfg.id,
        });
      }
    }

    // Count initial territory (city center + up to 6 neighbors)
    let territoryCount = 1; // city center
    for (const nb of neighbors) {
      if (tiles.has(hexKey(nb))) {
        territoryCount += 1;
      }
    }

    // Create 1 army led by first general near capital
    const firstGeneral = factionGeneralDefs[0];
    const landNeighbors = neighbors.filter((nb) => tiles.has(hexKey(nb)));
    const armyCoord = landNeighbors.length > 0 ? landNeighbors[0] : spawn;

    const armyId = nextArmyId(cfg.id);
    armies.set(armyId, {
      id: armyId,
      factionId: cfg.id,
      generalId: firstGeneral.id,
      troops: { ...STARTING_ARMY_TROOPS },
      coord: armyCoord,
      target: null,
      state: "idle",
    });

    // Create faction
    factions.set(cfg.id, {
      id: cfg.id,
      name: cfg.name,
      modelProvider: cfg.modelProvider,
      color: cfg.color,
      resources: { ...STARTING_RESOURCES },
      techs: [],
      alive: true,
      territoryCount,
    });
  }

  const diplomacy: DiplomacyState = { relations: new Map() };

  return {
    tick: 0,
    tiles,
    armies,
    generals,
    cities,
    factions,
    diplomacy,
    log: [],
    winner: null,
    mapSize: mapRadius,
  };
}

// === Query helpers ===

export function getTile(
  state: GameState,
  coord: HexCoord,
): Tile | undefined {
  return state.tiles.get(hexKey(coord));
}

export function getArmiesAt(
  state: GameState,
  coord: HexCoord,
): Army[] {
  const key = hexKey(coord);
  const results: Army[] = [];
  for (const army of state.armies.values()) {
    if (hexKey(army.coord) === key) {
      results.push(army);
    }
  }
  return results;
}

export function getCityAt(
  state: GameState,
  coord: HexCoord,
): City | undefined {
  for (const city of state.cities.values()) {
    if (hexKey(city.coord) === hexKey(coord)) {
      return city;
    }
  }
  return undefined;
}

export function getFactionCities(
  state: GameState,
  factionId: FactionId,
): City[] {
  const results: City[] = [];
  for (const city of state.cities.values()) {
    if (city.factionId === factionId) {
      results.push(city);
    }
  }
  return results;
}

export function getFactionArmies(
  state: GameState,
  factionId: FactionId,
): Army[] {
  const results: Army[] = [];
  for (const army of state.armies.values()) {
    if (army.factionId === factionId) {
      results.push(army);
    }
  }
  return results;
}

export function getFactionGenerals(
  state: GameState,
  factionId: FactionId,
): General[] {
  const results: General[] = [];
  for (const general of state.generals.values()) {
    if (general.factionId === factionId) {
      results.push(general);
    }
  }
  return results;
}

export function isFactionAlive(
  state: GameState,
  factionId: FactionId,
): boolean {
  return getFactionCities(state, factionId).length > 0;
}

export function getAvailableGenerals(
  state: GameState,
  factionId: FactionId,
): General[] {
  const leadingGeneralIds = new Set<GeneralId>();
  for (const army of state.armies.values()) {
    if (army.factionId === factionId) {
      leadingGeneralIds.add(army.generalId);
    }
  }

  return getFactionGenerals(state, factionId).filter(
    (g) => g.alive && g.respawnTick === null && !leadingGeneralIds.has(g.id),
  );
}

// === Immutable state updaters ===

export function setTile(
  state: GameState,
  coord: HexCoord,
  updates: Partial<Tile>,
): GameState {
  const key = hexKey(coord);
  const tile = state.tiles.get(key);
  if (!tile) return state;

  const newTiles = new Map(state.tiles);
  newTiles.set(key, { ...tile, ...updates });

  return { ...state, tiles: newTiles };
}

export function addArmy(state: GameState, army: Army): GameState {
  const newArmies = new Map(state.armies);
  newArmies.set(army.id, army);
  return { ...state, armies: newArmies };
}

export function removeArmy(state: GameState, armyId: ArmyId): GameState {
  const newArmies = new Map(state.armies);
  newArmies.delete(armyId);
  return { ...state, armies: newArmies };
}

export function updateArmy(
  state: GameState,
  armyId: ArmyId,
  updates: Partial<Army>,
): GameState {
  const army = state.armies.get(armyId);
  if (!army) return state;

  const newArmies = new Map(state.armies);
  newArmies.set(armyId, { ...army, ...updates });
  return { ...state, armies: newArmies };
}

export function addCity(state: GameState, city: City): GameState {
  const newCities = new Map(state.cities);
  newCities.set(city.id, city);
  return { ...state, cities: newCities };
}

export function updateCity(
  state: GameState,
  cityId: CityId,
  updates: Partial<City>,
): GameState {
  const city = state.cities.get(cityId);
  if (!city) return state;

  const newCities = new Map(state.cities);
  newCities.set(cityId, { ...city, ...updates });
  return { ...state, cities: newCities };
}

export function removeCity(state: GameState, cityId: CityId): GameState {
  const newCities = new Map(state.cities);
  newCities.delete(cityId);
  return { ...state, cities: newCities };
}

export function updateFaction(
  state: GameState,
  factionId: FactionId,
  updates: Partial<Faction>,
): GameState {
  const faction = state.factions.get(factionId);
  if (!faction) return state;

  const newFactions = new Map(state.factions);
  newFactions.set(factionId, { ...faction, ...updates });
  return { ...state, factions: newFactions };
}

export function updateGeneral(
  state: GameState,
  generalId: GeneralId,
  updates: Partial<General>,
): GameState {
  const general = state.generals.get(generalId);
  if (!general) return state;

  const newGenerals = new Map(state.generals);
  newGenerals.set(generalId, { ...general, ...updates });
  return { ...state, generals: newGenerals };
}

export function addLogEntry(
  state: GameState,
  message: string,
  category: LogEntry["category"],
  involvedFactions: readonly FactionId[],
): GameState {
  const entry: LogEntry = {
    tick: state.tick,
    message,
    category,
    involvedFactions,
  };
  return { ...state, log: [...state.log, entry] };
}

export function advanceTick(state: GameState): GameState {
  return { ...state, tick: state.tick + 1 };
}
