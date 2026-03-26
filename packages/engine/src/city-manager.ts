import type {
  GameState,
  CityId,
  City,
  Tile,
  ProductionProject,
  FactionId,
  BuildingType,
} from "@xpoch/shared";
import {
  hexKey,
  hexNeighbors,
  hexDistance,
  TERRAIN_PRODUCTION,
  BUILDING_STATS,
  RUSH_GOLD_MULTIPLIER,
  MIN_CITY_DISTANCE,
  MAX_CITIES,
  UNIT_STATS,
} from "@xpoch/shared";
import {
  updateCity,
  addCity,
  addUnit,
  updateFaction,
  addLogEntry,
  setTile,
  removeUnit,
} from "./game-state";
import { createUnit } from "./unit-factory";
import type { UnitType } from "@xpoch/shared";

// === Helpers ===

/**
 * Gather all outskirt tiles for a given city.
 */
function getCityOutskirtTiles(state: GameState, cityId: CityId): readonly Tile[] {
  const tiles: Tile[] = [];
  for (const tile of state.tiles.values()) {
    if (tile.isCityOutskirt === cityId) {
      tiles.push(tile);
    }
  }
  return tiles;
}

/**
 * Get the city center tile.
 */
function getCityCenterTile(state: GameState, cityId: CityId): Tile | undefined {
  for (const tile of state.tiles.values()) {
    if (tile.cityId === cityId) {
      return tile;
    }
  }
  return undefined;
}

// === Public API ===

/**
 * Calculate production output for a city (from outskirt terrain + buildings).
 */
export function calculateCityProduction(state: GameState, cityId: CityId): number {
  const outskirts = getCityOutskirtTiles(state, cityId);

  let production = 0;
  for (const tile of outskirts) {
    production += TERRAIN_PRODUCTION[tile.terrain];
    if (tile.building !== null) {
      production += BUILDING_STATS[tile.building].productionBonus;
    }
  }

  return production;
}

/**
 * Start a production project in a city.
 */
export function startProject(
  state: GameState,
  cityId: CityId,
  projectType: "unit" | "building" | "wonder",
  target: string,
  cost: number,
): GameState {
  const city = state.cities.get(cityId);
  if (city === undefined) return state;

  const project: ProductionProject = {
    type: projectType,
    target,
    invested: 0,
    cost,
  };

  return updateCity(state, cityId, { currentProject: project });
}

/**
 * Rush production with gold (costs RUSH_GOLD_MULTIPLIER x remaining production in gold).
 */
export function rushProduction(state: GameState, cityId: CityId): GameState {
  const city = state.cities.get(cityId);
  if (city === undefined || city.currentProject === null) return state;

  const remaining = city.currentProject.cost - city.currentProject.invested;
  if (remaining <= 0) return state;

  const goldCost = remaining * RUSH_GOLD_MULTIPLIER;
  const faction = state.factions.get(city.factionId);
  if (faction === undefined || faction.gold < goldCost) return state;

  let s = updateFaction(state, city.factionId, { gold: faction.gold - goldCost });

  // Complete the project by setting invested = cost
  s = updateCity(s, cityId, {
    currentProject: {
      ...city.currentProject,
      invested: city.currentProject.cost,
    },
  });

  // Process completion
  return completeProject(s, cityId);
}

/**
 * Process city production for one tick.
 * Each city with a currentProject adds its production output.
 * If accumulated >= cost, the project completes.
 */
export function processCityProduction(state: GameState): GameState {
  let s = state;

  for (const [cityId, city] of s.cities) {
    if (city.currentProject === null) continue;

    const output = calculateCityProduction(s, cityId);
    const newInvested = city.currentProject.invested + output;

    if (newInvested >= city.currentProject.cost) {
      // Update invested to full cost, then complete
      s = updateCity(s, cityId, {
        currentProject: {
          ...city.currentProject,
          invested: city.currentProject.cost,
        },
      });
      s = completeProject(s, cityId);
    } else {
      s = updateCity(s, cityId, {
        currentProject: {
          ...city.currentProject,
          invested: newInvested,
        },
      });
    }
  }

  return s;
}

/**
 * Complete a finished project in a city.
 */
function completeProject(state: GameState, cityId: CityId): GameState {
  const city = state.cities.get(cityId);
  if (city === undefined || city.currentProject === null) return state;

  const project = city.currentProject;
  let s = state;

  switch (project.type) {
    case "unit": {
      const unitType = project.target as UnitType;
      const unitCost = UNIT_STATS[unitType]?.cost ?? 0;
      const faction = s.factions.get(city.factionId);
      if (faction !== undefined) {
        s = updateFaction(s, city.factionId, { gold: faction.gold - unitCost });
      }
      const unit = createUnit(city.factionId, unitType, city.coord);
      s = addUnit(s, unit);
      s = addLogEntry(
        s,
        `${city.name} trained a ${unitType}.`,
        "city",
        [city.factionId],
      );
      break;
    }

    case "building": {
      const buildingType = project.target as BuildingType;
      // Place building on the first available outskirt tile
      const outskirts = getCityOutskirtTiles(s, cityId);
      const availableTile = outskirts.find((t) => t.building === null);
      if (availableTile !== undefined) {
        s = setTile(s, availableTile.coord, { building: buildingType });
      }
      // If building city_walls, mark the city as having walls
      if (buildingType === "city_walls") {
        s = updateCity(s, cityId, { hasWalls: true });
      }
      s = addLogEntry(
        s,
        `${city.name} built a ${buildingType}.`,
        "city",
        [city.factionId],
      );
      break;
    }

    case "wonder": {
      const wonderId = project.target;
      const updatedWonders = s.wonders.map((w) =>
        w.id === wonderId
          ? { ...w, builtBy: city.factionId, cityId }
          : w,
      );
      s = { ...s, wonders: updatedWonders };
      s = addLogEntry(
        s,
        `${city.name} completed the wonder: ${wonderId}!`,
        "city",
        [city.factionId],
      );
      break;
    }
  }

  // Clear the project
  s = updateCity(s, cityId, { currentProject: null });

  return s;
}

/**
 * Auto-found cities for settler units that are far enough from all existing cities
 * and standing on valid (non-water, non-mountain) terrain.
 * Called each tick from the game loop.
 */
export function autoFoundCities(state: GameState): GameState {
  let s = state;

  // Collect settler units (snapshot the IDs first since founding removes the unit)
  const settlers = [...s.units.values()].filter((u) => u.type === "settler");

  for (const settler of settlers) {
    // Check if settler still exists (may have been consumed in earlier iteration)
    if (!s.units.has(settler.id)) continue;

    const coord = settler.coord;
    const tile = s.tiles.get(hexKey(coord));

    // Must be on valid terrain
    if (!tile || tile.terrain === "water" || tile.terrain === "mountain") continue;

    // Must be far enough from ALL existing cities
    let tooClose = false;
    for (const city of s.cities.values()) {
      if (hexDistance(coord, city.coord) < MIN_CITY_DISTANCE) {
        tooClose = true;
        break;
      }
    }
    if (tooClose) continue;

    // Check faction city limit — don't exceed MAX_CITIES
    const factionCityCount = [...s.cities.values()].filter(
      (c) => c.factionId === settler.factionId,
    ).length;
    if (factionCityCount >= MAX_CITIES) continue;

    const factionName = s.factions.get(settler.factionId)?.name ?? settler.factionId;
    const cityName = `${factionName} Colony ${factionCityCount}`;

    s = foundCity(s, settler.id, cityName);
  }

  return s;
}

/**
 * Found a new city using a settler unit.
 * Settler is consumed. City placed at settler's hex.
 * 6 surrounding non-water tiles become city outskirts.
 */
export function foundCity(
  state: GameState,
  unitId: string,
  cityName: string,
): GameState {
  const settler = state.units.get(unitId);
  if (settler === undefined || settler.type !== "settler") return state;

  const coord = settler.coord;
  const tileKey = hexKey(coord);
  const tile = state.tiles.get(tileKey);

  // Cannot found on water
  if (tile === undefined || tile.terrain === "water") return state;

  // Cannot found too close to another city
  for (const existingCity of state.cities.values()) {
    if (hexDistance(coord, existingCity.coord) < MIN_CITY_DISTANCE) {
      return state;
    }
  }

  // Generate city ID
  const factionCityCount = Array.from(state.cities.values())
    .filter((c) => c.factionId === settler.factionId)
    .length;
  const cityId: CityId = `${settler.factionId}-city-${factionCityCount}`;

  // Create the city
  const newCity: City = {
    id: cityId,
    factionId: settler.factionId,
    name: cityName,
    coord,
    isCapital: false,
    hasWalls: false,
    production: 0,
    currentProject: null,
  };

  let s = addCity(state, newCity);

  // Mark center tile
  s = setTile(s, coord, {
    owner: settler.factionId,
    cityId,
    isCityOutskirt: null,
  });

  // Mark surrounding non-water tiles as outskirts
  const neighbors = hexNeighbors(coord);
  for (const nc of neighbors) {
    const nt = s.tiles.get(hexKey(nc));
    if (nt !== undefined && nt.terrain !== "water") {
      s = setTile(s, nc, {
        owner: settler.factionId,
        isCityOutskirt: cityId,
      });
    }
  }

  // Remove the settler
  s = removeUnit(s, unitId);

  s = addLogEntry(
    s,
    `${cityName} has been founded!`,
    "city",
    [settler.factionId],
  );

  return s;
}
