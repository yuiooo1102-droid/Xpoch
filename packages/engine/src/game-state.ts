import type {
  GameState,
  Faction,
  FactionId,
  Tile,
  HexCoord,
  DiplomacyState,
  Unit,
  City,
  CityId,
  LogEntry,
} from "@xpoch/shared";
import {
  hexKey,
  hexDisk,
  hexDistance,
  hexNeighbors,
  UNIT_STATS,
  STARTING_GOLD,
  STARTING_FOOD,
  WONDER_DEFS,
} from "@xpoch/shared";
import { generateMap } from "./map-generator";

// === Public types ===

export interface FactionConfig {
  readonly id: FactionId;
  readonly name: string;
  readonly modelProvider: string;
  readonly color: string;
}

// === Helpers ===

let unitCounter = 0;

function nextUnitId(factionId: FactionId): string {
  unitCounter += 1;
  return `${factionId}-unit-${unitCounter}`;
}

/** Reset counter (useful for deterministic tests) */
export function _resetUnitCounter(): void {
  unitCounter = 0;
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

function createUnit(
  factionId: FactionId,
  type: Unit["type"],
  coord: HexCoord,
): Unit {
  const stats = UNIT_STATS[type];
  return {
    id: nextUnitId(factionId),
    factionId,
    type,
    coord,
    strength: stats.strength,
    maxStrength: stats.strength,
    movement: stats.movement,
    maxMovement: stats.movement,
    upgraded: false,
  };
}

function makeCityId(factionId: FactionId, index: number): CityId {
  return `${factionId}-city-${index}`;
}

// === State creation ===

export function createInitialState(
  mapRadius: number,
  seed: number,
  factionConfigs: readonly FactionConfig[],
): GameState {
  _resetUnitCounter();

  const baseTiles = generateMap(mapRadius, seed);
  const tiles = new Map(baseTiles);
  const factions = new Map<FactionId, Faction>();
  const units = new Map<string, Unit>();
  const cities = new Map<CityId, City>();
  const spawnCoords = pickSpawnPositions(mapRadius, factionConfigs.length);

  for (let i = 0; i < factionConfigs.length; i++) {
    const cfg = factionConfigs[i];
    const spawn = spawnCoords[i];

    // Create faction
    factions.set(cfg.id, {
      id: cfg.id,
      name: cfg.name,
      modelProvider: cfg.modelProvider,
      color: cfg.color,
      gold: STARTING_GOLD,
      food: STARTING_FOOD,
      storedFood: 0,
      research: 0,
      techs: [],
      alive: true,
      controlledResources: [],
    });

    // Create capital city
    const cityId = makeCityId(cfg.id, 0);
    cities.set(cityId, {
      id: cityId,
      factionId: cfg.id,
      name: `${cfg.name} Capital`,
      coord: spawn,
      isCapital: true,
      hasWalls: false,
      production: 0,
      currentProject: null,
    });

    // Ensure city center tile is land (plains) and assign to faction + city
    const spawnKey = hexKey(spawn);
    const existingCenter = tiles.get(spawnKey);
    if (existingCenter) {
      tiles.set(spawnKey, {
        ...existingCenter,
        terrain: existingCenter.terrain === "water" ? "plains" : existingCenter.terrain,
        owner: cfg.id,
        cityId,
        isCityOutskirt: null,
      });
    }

    // Mark 6 surrounding tiles as city outskirts (owned by faction)
    const neighbors = hexNeighbors(spawn);
    for (const nb of neighbors) {
      const nbKey = hexKey(nb);
      const nbTile = tiles.get(nbKey);
      if (nbTile) {
        tiles.set(nbKey, {
          ...nbTile,
          terrain: nbTile.terrain === "water" ? "plains" : nbTile.terrain,
          owner: cfg.id,
          isCityOutskirt: cityId,
        });
      }
    }

    // Place starting units: 2 infantry + 1 scout near the capital
    const landNeighbors = neighbors
      .filter((nb) => tiles.get(hexKey(nb)) !== undefined)
      .slice(0, 3);

    const startingTypes: Unit["type"][] = ["infantry", "infantry", "scout"];
    for (let u = 0; u < startingTypes.length; u++) {
      const coord = landNeighbors[u % landNeighbors.length];
      const unit = createUnit(cfg.id, startingTypes[u], coord);
      units.set(unit.id, unit);
    }
  }

  const diplomacy: DiplomacyState = { relations: new Map() };

  const wonders = WONDER_DEFS.map((def) => ({
    id: def.id,
    name: def.name,
    era: def.era,
    cost: def.cost,
    effect: def.effect,
    builtBy: null,
    cityId: null,
  }));

  return {
    tick: 0,
    tiles,
    units,
    cities,
    factions,
    wonders,
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

export function getUnitsAt(
  state: GameState,
  coord: HexCoord,
): Unit[] {
  const key = hexKey(coord);
  const results: Unit[] = [];
  for (const unit of state.units.values()) {
    if (hexKey(unit.coord) === key) {
      results.push(unit);
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

export function isFactionAlive(
  state: GameState,
  factionId: FactionId,
): boolean {
  return getFactionCities(state, factionId).length > 0;
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

export function addUnit(state: GameState, unit: Unit): GameState {
  const newUnits = new Map(state.units);
  newUnits.set(unit.id, unit);
  return { ...state, units: newUnits };
}

export function removeUnit(state: GameState, unitId: string): GameState {
  const newUnits = new Map(state.units);
  newUnits.delete(unitId);
  return { ...state, units: newUnits };
}

export function updateUnit(
  state: GameState,
  unitId: string,
  updates: Partial<Unit>,
): GameState {
  const unit = state.units.get(unitId);
  if (!unit) return state;

  const newUnits = new Map(state.units);
  newUnits.set(unitId, { ...unit, ...updates });
  return { ...state, units: newUnits };
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

export function addLogEntry(
  state: GameState,
  message: string,
  category: LogEntry["category"],
  involvedFactions: FactionId[],
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
