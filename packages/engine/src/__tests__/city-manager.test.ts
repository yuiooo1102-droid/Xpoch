import { describe, it, expect } from "vitest";
import type { GameState, Faction, FactionId, Tile, City, Unit, HexCoord } from "@xpoch/shared";
import { hexKey, hexNeighbors, TERRAIN_PRODUCTION, BUILDING_STATS, RUSH_GOLD_MULTIPLIER, MIN_CITY_DISTANCE, UNIT_STATS } from "@xpoch/shared";
import {
  processCityProduction,
  startProject,
  rushProduction,
  calculateCityProduction,
  foundCity,
} from "../city-manager";

// === Test Helpers ===

function makeTile(overrides: Partial<Tile> & { coord: HexCoord }): Tile {
  return {
    terrain: "plains",
    owner: null,
    naturalResource: null,
    building: null,
    cityId: null,
    isCityOutskirt: null,
    ...overrides,
  };
}

function makeFaction(overrides: Partial<Faction> & { id: FactionId }): Faction {
  return {
    name: "Test Faction",
    modelProvider: "mock",
    color: "#f00",
    gold: 100,
    food: 10,
    storedFood: 0,
    research: 0,
    techs: [],
    alive: true,
    controlledResources: [],
    ...overrides,
  };
}

function makeCity(overrides: Partial<City> & { id: string; factionId: FactionId; coord: HexCoord }): City {
  return {
    name: "Test City",
    isCapital: true,
    hasWalls: false,
    production: 0,
    currentProject: null,
    ...overrides,
  };
}

function makeUnit(overrides: Partial<Unit> & { id: string; factionId: FactionId; coord: HexCoord }): Unit {
  return {
    type: "infantry",
    strength: 3,
    maxStrength: 3,
    movement: 1,
    maxMovement: 1,
    upgraded: false,
    ...overrides,
  };
}

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    tick: 0,
    tiles: new Map(),
    units: new Map(),
    cities: new Map(),
    factions: new Map(),
    wonders: [],
    diplomacy: { relations: new Map() },
    log: [],
    winner: null,
    mapSize: 5,
    ...overrides,
  };
}

/**
 * Create a state with a city and outskirt tiles.
 */
function makeStateWithCity(
  cityId: string,
  factionId: FactionId,
  cityCoord: HexCoord,
  outskirtsOverrides?: Partial<Tile>,
): GameState {
  const tiles = new Map<string, Tile>();
  const cities = new Map<string, City>();
  const factions = new Map<FactionId, Faction>();

  // City center tile
  tiles.set(hexKey(cityCoord), makeTile({
    coord: cityCoord,
    terrain: "plains",
    owner: factionId,
    cityId,
  }));

  // Outskirt tiles
  const neighbors = hexNeighbors(cityCoord);
  for (const nc of neighbors) {
    tiles.set(hexKey(nc), makeTile({
      coord: nc,
      terrain: "plains",
      owner: factionId,
      isCityOutskirt: cityId,
      ...outskirtsOverrides,
    }));
  }

  cities.set(cityId, makeCity({ id: cityId, factionId, coord: cityCoord }));
  factions.set(factionId, makeFaction({ id: factionId }));

  return makeState({ tiles, cities, factions });
}

// === Tests ===

describe("calculateCityProduction", () => {
  it("sums terrain production from outskirt tiles", () => {
    const state = makeStateWithCity("city1", "f1", { q: 0, r: 0 });
    const production = calculateCityProduction(state, "city1");

    // 6 plains outskirt tiles, each with TERRAIN_PRODUCTION.plains
    expect(production).toBe(6 * TERRAIN_PRODUCTION.plains);
  });

  it("includes building production bonuses", () => {
    const state = makeStateWithCity("city1", "f1", { q: 0, r: 0 }, {
      building: "workshop",
    });
    const production = calculateCityProduction(state, "city1");

    // 6 tiles * (plains terrain prod + workshop bonus)
    const expected = 6 * (TERRAIN_PRODUCTION.plains + BUILDING_STATS.workshop.productionBonus);
    expect(production).toBe(expected);
  });

  it("returns 0 for city with no outskirts", () => {
    const tiles = new Map<string, Tile>();
    const coord: HexCoord = { q: 0, r: 0 };
    tiles.set(hexKey(coord), makeTile({ coord, terrain: "plains", owner: "f1", cityId: "city1" }));

    const cities = new Map<string, City>();
    cities.set("city1", makeCity({ id: "city1", factionId: "f1", coord }));

    const state = makeState({ tiles, cities });
    expect(calculateCityProduction(state, "city1")).toBe(0);
  });
});

describe("processCityProduction", () => {
  it("accumulates production per tick", () => {
    let state = makeStateWithCity("city1", "f1", { q: 0, r: 0 });
    state = startProject(state, "city1", "building", "granary", 100);

    const next = processCityProduction(state);
    const city = next.cities.get("city1")!;
    const expectedOutput = calculateCityProduction(state, "city1");

    expect(city.currentProject).not.toBeNull();
    expect(city.currentProject!.invested).toBe(expectedOutput);
  });

  it("completes project when enough production accumulated", () => {
    let state = makeStateWithCity("city1", "f1", { q: 0, r: 0 });
    const output = calculateCityProduction(state, "city1");

    // Set cost low enough to complete in one tick
    state = startProject(state, "city1", "building", "granary", output);

    const next = processCityProduction(state);
    const city = next.cities.get("city1")!;

    // Project should be cleared after completion
    expect(city.currentProject).toBeNull();
  });

  it("creates unit when unit project completes", () => {
    let state = makeStateWithCity("city1", "f1", { q: 0, r: 0 });
    const output = calculateCityProduction(state, "city1");

    state = startProject(state, "city1", "unit", "infantry", output);

    const next = processCityProduction(state);

    // A new unit should exist
    let foundUnit = false;
    for (const unit of next.units.values()) {
      if (unit.factionId === "f1" && unit.type === "infantry") {
        foundUnit = true;
        break;
      }
    }
    expect(foundUnit).toBe(true);
  });

  it("places building when building project completes", () => {
    let state = makeStateWithCity("city1", "f1", { q: 0, r: 0 });
    const output = calculateCityProduction(state, "city1");

    state = startProject(state, "city1", "building", "library", output);

    const next = processCityProduction(state);

    // At least one outskirt tile should now have a library
    let foundBuilding = false;
    for (const tile of next.tiles.values()) {
      if (tile.isCityOutskirt === "city1" && tile.building === "library") {
        foundBuilding = true;
        break;
      }
    }
    expect(foundBuilding).toBe(true);
  });

  it("does nothing for cities without projects", () => {
    const state = makeStateWithCity("city1", "f1", { q: 0, r: 0 });
    const next = processCityProduction(state);

    // Nothing should change
    expect(next.cities.get("city1")!.currentProject).toBeNull();
  });
});

describe("startProject", () => {
  it("sets the current project on a city", () => {
    const state = makeStateWithCity("city1", "f1", { q: 0, r: 0 });
    const next = startProject(state, "city1", "unit", "cavalry", 20);

    const city = next.cities.get("city1")!;
    expect(city.currentProject).not.toBeNull();
    expect(city.currentProject!.type).toBe("unit");
    expect(city.currentProject!.target).toBe("cavalry");
    expect(city.currentProject!.cost).toBe(20);
    expect(city.currentProject!.invested).toBe(0);
  });

  it("returns unchanged state for unknown city", () => {
    const state = makeState();
    const next = startProject(state, "nonexistent", "unit", "infantry", 10);
    expect(next).toBe(state);
  });
});

describe("rushProduction", () => {
  it("spends gold to complete production", () => {
    let state = makeStateWithCity("city1", "f1", { q: 0, r: 0 });
    state = startProject(state, "city1", "building", "granary", 10);

    const factionBefore = state.factions.get("f1")!;
    const next = rushProduction(state, "city1");

    const factionAfter = next.factions.get("f1")!;
    const expectedCost = 10 * RUSH_GOLD_MULTIPLIER;
    expect(factionAfter.gold).toBe(factionBefore.gold - expectedCost);

    // Project should be completed
    expect(next.cities.get("city1")!.currentProject).toBeNull();
  });

  it("does nothing if faction cannot afford rush", () => {
    let state = makeStateWithCity("city1", "f1", { q: 0, r: 0 });

    // Set gold to 0
    const factions = new Map(state.factions);
    factions.set("f1", { ...factions.get("f1")!, gold: 0 });
    state = { ...state, factions };

    state = startProject(state, "city1", "building", "granary", 10);

    const next = rushProduction(state, "city1");
    // Project should still exist
    expect(next.cities.get("city1")!.currentProject).not.toBeNull();
  });

  it("does nothing if city has no project", () => {
    const state = makeStateWithCity("city1", "f1", { q: 0, r: 0 });
    const next = rushProduction(state, "city1");
    expect(next).toBe(state);
  });
});

describe("foundCity", () => {
  function makeFoundingState(): GameState {
    const coord: HexCoord = { q: 5, r: 5 };
    const tiles = new Map<string, Tile>();

    // Place tiles around the founding location
    tiles.set(hexKey(coord), makeTile({ coord, terrain: "plains" }));
    const neighbors = hexNeighbors(coord);
    for (const nc of neighbors) {
      tiles.set(hexKey(nc), makeTile({ coord: nc, terrain: "plains" }));
    }

    const units = new Map<string, Unit>();
    units.set("settler1", makeUnit({
      id: "settler1",
      factionId: "f1",
      coord,
      type: "settler",
      strength: 0,
    }));

    const factions = new Map<FactionId, Faction>();
    factions.set("f1", makeFaction({ id: "f1" }));

    return makeState({ tiles, units, factions });
  }

  it("creates a city at the settler location", () => {
    const state = makeFoundingState();
    const next = foundCity(state, "settler1", "New Town");

    // Should have one city now
    expect(next.cities.size).toBe(1);
    const city = Array.from(next.cities.values())[0];
    expect(city.name).toBe("New Town");
    expect(city.factionId).toBe("f1");
    expect(city.coord).toEqual({ q: 5, r: 5 });
  });

  it("consumes the settler unit", () => {
    const state = makeFoundingState();
    const next = foundCity(state, "settler1", "New Town");
    expect(next.units.has("settler1")).toBe(false);
  });

  it("marks surrounding tiles as city outskirts", () => {
    const state = makeFoundingState();
    const next = foundCity(state, "settler1", "New Town");

    const cityId = Array.from(next.cities.values())[0].id;
    const neighbors = hexNeighbors({ q: 5, r: 5 });
    for (const nc of neighbors) {
      const tile = next.tiles.get(hexKey(nc));
      expect(tile?.isCityOutskirt).toBe(cityId);
      expect(tile?.owner).toBe("f1");
    }
  });

  it("cannot found city on water", () => {
    const state = makeFoundingState();

    // Change the settler's tile to water
    const tiles = new Map(state.tiles);
    const waterCoord: HexCoord = { q: 5, r: 5 };
    tiles.set(hexKey(waterCoord), makeTile({ coord: waterCoord, terrain: "water" }));
    const waterState = { ...state, tiles };

    const next = foundCity(waterState, "settler1", "Water City");
    // Should not create a city
    expect(next.cities.size).toBe(0);
  });

  it("cannot found city too close to another city", () => {
    let state = makeFoundingState();

    // Add an existing city nearby (within MIN_CITY_DISTANCE)
    const nearbyCoord: HexCoord = { q: 5, r: 5 + MIN_CITY_DISTANCE - 1 };
    const cities = new Map<string, City>();
    cities.set("existing", makeCity({
      id: "existing",
      factionId: "f2",
      coord: nearbyCoord,
    }));
    state = { ...state, cities };

    const next = foundCity(state, "settler1", "Too Close");
    // Should still have only the existing city
    expect(next.cities.size).toBe(1);
    expect(next.cities.has("existing")).toBe(true);
  });

  it("does not mark water tiles as outskirts", () => {
    const state = makeFoundingState();

    // Make one neighbor a water tile
    const tiles = new Map(state.tiles);
    const waterNeighbor = hexNeighbors({ q: 5, r: 5 })[0];
    tiles.set(hexKey(waterNeighbor), makeTile({
      coord: waterNeighbor,
      terrain: "water",
    }));
    const modifiedState = { ...state, tiles };

    const next = foundCity(modifiedState, "settler1", "Coast Town");

    const waterTile = next.tiles.get(hexKey(waterNeighbor));
    expect(waterTile?.isCityOutskirt).toBeNull();
  });

  it("returns unchanged state for non-settler unit", () => {
    const state = makeFoundingState();

    // Replace settler with infantry
    const units = new Map(state.units);
    units.set("settler1", makeUnit({
      id: "settler1",
      factionId: "f1",
      coord: { q: 5, r: 5 },
      type: "infantry",
    }));
    const modifiedState = { ...state, units };

    const next = foundCity(modifiedState, "settler1", "Bad City");
    expect(next.cities.size).toBe(0);
  });
});
