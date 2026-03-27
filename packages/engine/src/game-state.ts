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
  MAP_SIZE,
} from "@xpoch/shared";
import { generateMap } from "./map-generator";
import { generateThreeKingdomsMap, getPresetCities } from "./three-kingdoms-map";
import type { CityPreset } from "./three-kingdoms-map";

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

/**
 * Determine whether to use the fixed Three Kingdoms map.
 * The fixed map is used when all factions have historicalFaction set
 * and cover shu, wei, wu.
 */
function shouldUseThreeKingdomsMap(
  factionConfigs: readonly FactionConfig[],
): boolean {
  const historicalFactions = new Set(
    factionConfigs.map((cfg) => cfg.historicalFaction).filter(Boolean),
  );
  return (
    historicalFactions.has("shu") &&
    historicalFactions.has("wei") &&
    historicalFactions.has("wu")
  );
}

/**
 * Map faction config historicalFaction to the matching factionId.
 */
function buildHistoricalFactionMap(
  factionConfigs: readonly FactionConfig[],
): ReadonlyMap<HistoricalFaction, FactionId> {
  const mapping = new Map<HistoricalFaction, FactionId>();
  for (const cfg of factionConfigs) {
    if (cfg.historicalFaction) {
      mapping.set(cfg.historicalFaction, cfg.id);
    }
  }
  return mapping;
}

/**
 * Place a single preset city on the map.
 * Mutates the tiles map (called during initialization only).
 */
function placeCityOnTiles(
  tiles: Map<string, Tile>,
  cityId: CityId,
  coord: HexCoord,
  ownerId: FactionId | null,
): void {
  const key = hexKey(coord);
  const existing = tiles.get(key);
  if (existing) {
    tiles.set(key, {
      ...existing,
      owner: ownerId,
      cityId,
    });
  }
}

/**
 * Mark territory around a faction city (city tile + 6 neighbors).
 * Mutates the tiles map (called during initialization only).
 * Returns the territory count.
 */
function claimInitialTerritory(
  tiles: Map<string, Tile>,
  coord: HexCoord,
  factionId: FactionId,
): number {
  let count = 0;

  // City center is already claimed via placeCityOnTiles
  const centerTile = tiles.get(hexKey(coord));
  if (centerTile && centerTile.owner === factionId) {
    count = 1;
  }

  // Claim 6 neighbors
  const neighbors = hexNeighbors(coord);
  for (const nb of neighbors) {
    const nbKey = hexKey(nb);
    const nbTile = tiles.get(nbKey);
    if (nbTile && nbTile.owner === null) {
      tiles.set(nbKey, { ...nbTile, owner: factionId });
      count += 1;
    }
  }

  return count;
}

export function createInitialState(
  mapRadius: number,
  seed: number,
  factionConfigs: readonly FactionConfig[],
): GameState {
  _resetCounters();

  const rng = createRng(seed + 9999);
  const useThreeKingdoms = shouldUseThreeKingdomsMap(factionConfigs);

  const baseTiles = useThreeKingdoms
    ? generateThreeKingdomsMap()
    : generateMap(mapRadius, seed);
  const tiles = new Map(baseTiles);
  const factions = new Map<FactionId, Faction>();
  const armies = new Map<ArmyId, Army>();
  const generals = new Map<GeneralId, General>();
  const cities = new Map<CityId, City>();

  // Assign generals with historical faction preference
  const factionGeneralMap = assignHistoricalGenerals(
    factionConfigs,
    GENERALS_PER_FACTION,
    rng,
  );

  if (useThreeKingdoms) {
    // === THREE KINGDOMS FIXED MAP ===
    const hfMap = buildHistoricalFactionMap(factionConfigs);
    const presetCities = getPresetCities();
    const territoryCounts = new Map<FactionId, number>();

    // Initialize territory counts
    for (const cfg of factionConfigs) {
      territoryCounts.set(cfg.id, 0);
    }

    // Place all preset cities
    for (const preset of presetCities) {
      const ownerFactionId =
        preset.faction === "neutral"
          ? "neutral"
          : hfMap.get(preset.faction) ?? "neutral";

      const cityId = preset.id;
      const city: City = {
        id: cityId,
        factionId: ownerFactionId,
        name: preset.name,
        coord: preset.coord,
        isCapital: preset.isCapital,
        level: preset.level,
        walls: preset.isCapital ? 1 : 0,
        garrison: { ...preset.garrison },
        trainingQueue: null,
      };
      cities.set(cityId, city);

      // Place city tile
      placeCityOnTiles(tiles, cityId, preset.coord, ownerFactionId === "neutral" ? null : ownerFactionId);

      // Only claim territory for faction cities (not neutral)
      if (ownerFactionId !== "neutral") {
        const claimed = claimInitialTerritory(tiles, preset.coord, ownerFactionId);
        const prev = territoryCounts.get(ownerFactionId) ?? 0;
        territoryCounts.set(ownerFactionId, prev + claimed);
      }
    }

    // Set up each faction
    for (const cfg of factionConfigs) {
      const factionGeneralDefs = factionGeneralMap.get(cfg.id) ?? [];

      // Create generals
      for (const genDef of factionGeneralDefs) {
        generals.set(genDef.id, {
          id: genDef.id,
          defId: genDef.id,
          factionId: cfg.id,
          name: genDef.name,
          level: 1,
          exp: 0,
          alive: true,
          respawnTick: null,
        });
      }

      // Find the capital for this faction
      const capital = presetCities.find(
        (p) => p.isCapital && p.faction === cfg.historicalFaction,
      );

      // Create 1 army led by first general at capital
      if (factionGeneralDefs.length > 0 && capital) {
        const firstGeneral = factionGeneralDefs[0];
        const neighbors = hexNeighbors(capital.coord);
        const landNeighbors = neighbors.filter((nb) => {
          const t = tiles.get(hexKey(nb));
          return t && t.terrain !== "water";
        });
        const armyCoord = landNeighbors.length > 0 ? landNeighbors[0] : capital.coord;

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
      }

      // Create faction
      factions.set(cfg.id, {
        id: cfg.id,
        name: cfg.name,
        modelProvider: cfg.modelProvider,
        color: cfg.color,
        resources: { ...STARTING_RESOURCES },
        techs: [],
        alive: true,
        territoryCount: territoryCounts.get(cfg.id) ?? 0,
      });
    }
  } else {
    // === LEGACY RANDOM MAP ===
    const spawnCoords = pickSpawnPositions(mapRadius, factionConfigs.length);

    for (let i = 0; i < factionConfigs.length; i++) {
      const cfg = factionConfigs[i];
      const spawn = spawnCoords[i];

      const factionGeneralDefs = factionGeneralMap.get(cfg.id) ?? [];

      for (const genDef of factionGeneralDefs) {
        generals.set(genDef.id, {
          id: genDef.id,
          defId: genDef.id,
          factionId: cfg.id,
          name: genDef.name,
          level: 1,
          exp: 0,
          alive: true,
          respawnTick: null,
        });
      }

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

      let territoryCount = 1;
      for (const nb of neighbors) {
        if (tiles.has(hexKey(nb))) {
          territoryCount += 1;
        }
      }

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
  }

  const diplomacy: DiplomacyState = { relations: new Map() };
  const effectiveMapSize = useThreeKingdoms ? MAP_SIZE : mapRadius;

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
    mapSize: effectiveMapSize,
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
