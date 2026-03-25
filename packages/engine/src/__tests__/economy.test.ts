import { describe, it, expect } from "vitest";
import type { GameState, Faction, FactionId, Tile, City, Unit, HexCoord } from "@xpoch/shared";
import { hexKey, TERRAIN_GOLD, FOOD_PER_UNIT, BUILDING_STATS, BASE_FOOD_PER_CITY, BASE_RESEARCH_PER_CITY } from "@xpoch/shared";
import {
  processEconomy,
  calculateGoldIncome,
  calculateFoodBalance,
  calculateResearch,
} from "../economy";

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
    gold: 20,
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

// === Tests ===

describe("calculateGoldIncome", () => {
  it("sums TERRAIN_GOLD for all owned tiles", () => {
    const tiles = new Map<string, Tile>();
    const coord1: HexCoord = { q: 0, r: 0 };
    const coord2: HexCoord = { q: 1, r: 0 };
    const coord3: HexCoord = { q: 0, r: 1 };

    tiles.set(hexKey(coord1), makeTile({ coord: coord1, terrain: "plains", owner: "f1" }));
    tiles.set(hexKey(coord2), makeTile({ coord: coord2, terrain: "mountain", owner: "f1" }));
    tiles.set(hexKey(coord3), makeTile({ coord: coord3, terrain: "forest", owner: "f1" }));

    const state = makeState({ tiles });

    const income = calculateGoldIncome(state, "f1");
    expect(income).toBe(
      TERRAIN_GOLD.plains + TERRAIN_GOLD.mountain + TERRAIN_GOLD.forest,
    );
  });

  it("includes building gold bonuses", () => {
    const tiles = new Map<string, Tile>();
    const coord: HexCoord = { q: 0, r: 0 };
    tiles.set(hexKey(coord), makeTile({ coord, terrain: "plains", owner: "f1", building: "market" }));

    const state = makeState({ tiles });

    const income = calculateGoldIncome(state, "f1");
    expect(income).toBe(TERRAIN_GOLD.plains + BUILDING_STATS.market.goldBonus);
  });

  it("includes tiles owned via city outskirts", () => {
    const tiles = new Map<string, Tile>();
    const coord: HexCoord = { q: 0, r: 0 };
    tiles.set(hexKey(coord), makeTile({
      coord,
      terrain: "plains",
      owner: null,
      isCityOutskirt: "city1",
    }));

    const cities = new Map<string, City>();
    cities.set("city1", makeCity({
      id: "city1",
      factionId: "f1",
      coord: { q: 1, r: 0 },
    }));

    const state = makeState({ tiles, cities });
    const income = calculateGoldIncome(state, "f1");
    expect(income).toBe(TERRAIN_GOLD.plains);
  });

  it("returns 0 for faction with no owned tiles", () => {
    const state = makeState();
    expect(calculateGoldIncome(state, "f1")).toBe(0);
  });
});

describe("calculateFoodBalance", () => {
  it("plains produce 2 food per tile when faction has agriculture tech", () => {
    const tiles = new Map<string, Tile>();
    const coord1: HexCoord = { q: 0, r: 0 };
    const coord2: HexCoord = { q: 1, r: 0 };
    tiles.set(hexKey(coord1), makeTile({ coord: coord1, terrain: "plains", owner: "f1" }));
    tiles.set(hexKey(coord2), makeTile({ coord: coord2, terrain: "plains", owner: "f1" }));

    const factions = new Map<FactionId, Faction>();
    factions.set("f1", makeFaction({ id: "f1", techs: ["agriculture"] }));

    const state = makeState({ tiles, factions });
    const balance = calculateFoodBalance(state, "f1");
    // 2 plains * 2 food each (with agriculture) = 4, no cities so no base food
    expect(balance.produced).toBe(4);
    expect(balance.consumed).toBe(0);
    expect(balance.balance).toBe(4);
  });

  it("plains produce 1 base food without agriculture tech", () => {
    const tiles = new Map<string, Tile>();
    const coord: HexCoord = { q: 0, r: 0 };
    tiles.set(hexKey(coord), makeTile({ coord, terrain: "plains", owner: "f1" }));

    const factions = new Map<FactionId, Faction>();
    factions.set("f1", makeFaction({ id: "f1", techs: [] }));

    const state = makeState({ tiles, factions });
    const balance = calculateFoodBalance(state, "f1");
    // 1 plains * 1 base food = 1
    expect(balance.produced).toBe(1);
  });

  it("includes BASE_FOOD_PER_CITY from cities", () => {
    const tiles = new Map<string, Tile>();
    const cityCoord: HexCoord = { q: 0, r: 0 };
    tiles.set(hexKey(cityCoord), makeTile({ coord: cityCoord, terrain: "desert", owner: "f1", cityId: "city1" }));

    const factions = new Map<FactionId, Faction>();
    factions.set("f1", makeFaction({ id: "f1", techs: [] }));

    const cities = new Map<string, City>();
    cities.set("city1", makeCity({ id: "city1", factionId: "f1", coord: cityCoord }));

    const state = makeState({ tiles, factions, cities });
    const balance = calculateFoodBalance(state, "f1");
    expect(balance.produced).toBe(BASE_FOOD_PER_CITY);
  });

  it("granary buildings add food bonus", () => {
    const tiles = new Map<string, Tile>();
    const coord: HexCoord = { q: 0, r: 0 };
    tiles.set(hexKey(coord), makeTile({
      coord,
      terrain: "plains",
      owner: "f1",
      building: "granary",
    }));

    const factions = new Map<FactionId, Faction>();
    factions.set("f1", makeFaction({ id: "f1", techs: ["agriculture"] }));

    const state = makeState({ tiles, factions });
    const balance = calculateFoodBalance(state, "f1");
    // 2 from agriculture plains + 2 from granary
    expect(balance.produced).toBe(2 + BUILDING_STATS.granary.foodBonus);
  });

  it("units consume food", () => {
    const tiles = new Map<string, Tile>();
    const coord: HexCoord = { q: 0, r: 0 };
    tiles.set(hexKey(coord), makeTile({ coord, terrain: "plains", owner: "f1" }));

    const units = new Map<string, Unit>();
    units.set("u1", makeUnit({ id: "u1", factionId: "f1", coord }));
    units.set("u2", makeUnit({ id: "u2", factionId: "f1", coord }));

    const factions = new Map<FactionId, Faction>();
    factions.set("f1", makeFaction({ id: "f1" }));

    const state = makeState({ tiles, units, factions });
    const balance = calculateFoodBalance(state, "f1");
    expect(balance.consumed).toBe(2 * FOOD_PER_UNIT);
  });
});

describe("calculateResearch", () => {
  it("accumulates research from library buildings", () => {
    const tiles = new Map<string, Tile>();
    const coord: HexCoord = { q: 0, r: 0 };
    tiles.set(hexKey(coord), makeTile({
      coord,
      terrain: "plains",
      owner: "f1",
      building: "library",
    }));

    const state = makeState({ tiles });
    const research = calculateResearch(state, "f1");
    expect(research).toBe(BUILDING_STATS.library.researchBonus);
  });

  it("returns 0 with no research buildings", () => {
    const tiles = new Map<string, Tile>();
    const coord: HexCoord = { q: 0, r: 0 };
    tiles.set(hexKey(coord), makeTile({ coord, terrain: "plains", owner: "f1" }));

    const state = makeState({ tiles });
    expect(calculateResearch(state, "f1")).toBe(0);
  });
});

describe("processEconomy", () => {
  it("adds gold income to faction", () => {
    const tiles = new Map<string, Tile>();
    const coord: HexCoord = { q: 0, r: 0 };
    const cityCoord: HexCoord = { q: 1, r: 0 };
    tiles.set(hexKey(coord), makeTile({ coord, terrain: "plains", owner: "f1" }));
    tiles.set(hexKey(cityCoord), makeTile({ coord: cityCoord, terrain: "plains", owner: "f1", cityId: "city1" }));

    const factions = new Map<FactionId, Faction>();
    factions.set("f1", makeFaction({ id: "f1", gold: 10 }));

    const cities = new Map<string, City>();
    cities.set("city1", makeCity({ id: "city1", factionId: "f1", coord: cityCoord }));

    const state = makeState({ tiles, factions, cities });
    const next = processEconomy(state);

    const goldIncome = calculateGoldIncome(state, "f1");
    expect(next.factions.get("f1")!.gold).toBe(10 + goldIncome);
  });

  it("starvation reduces unit strength", () => {
    const tiles = new Map<string, Tile>();
    const coord: HexCoord = { q: 0, r: 0 };
    const coord2: HexCoord = { q: -1, r: 0 };
    const coord3: HexCoord = { q: 0, r: -1 };
    const coord4: HexCoord = { q: -1, r: 1 };
    const coord5: HexCoord = { q: 1, r: -1 };
    const cityCoord: HexCoord = { q: 1, r: 0 };
    tiles.set(hexKey(coord), makeTile({ coord, terrain: "desert", owner: "f1" }));
    tiles.set(hexKey(coord2), makeTile({ coord: coord2, terrain: "desert", owner: "f1" }));
    tiles.set(hexKey(coord3), makeTile({ coord: coord3, terrain: "desert", owner: "f1" }));
    tiles.set(hexKey(coord4), makeTile({ coord: coord4, terrain: "desert", owner: "f1" }));
    tiles.set(hexKey(coord5), makeTile({ coord: coord5, terrain: "desert", owner: "f1" }));
    tiles.set(hexKey(cityCoord), makeTile({ coord: cityCoord, terrain: "desert", owner: "f1", cityId: "city1" }));

    const factions = new Map<FactionId, Faction>();
    factions.set("f1", makeFaction({ id: "f1", food: 0, storedFood: 0, techs: [] }));

    // Need more units than BASE_FOOD_PER_CITY can feed to trigger starvation
    const units = new Map<string, Unit>();
    units.set("u1", makeUnit({ id: "u1", factionId: "f1", coord, strength: 3 }));
    units.set("u2", makeUnit({ id: "u2", factionId: "f1", coord: coord2, strength: 3 }));
    units.set("u3", makeUnit({ id: "u3", factionId: "f1", coord: coord3, strength: 3 }));
    units.set("u4", makeUnit({ id: "u4", factionId: "f1", coord: coord4, strength: 3 }));
    units.set("u5", makeUnit({ id: "u5", factionId: "f1", coord: coord5, strength: 3 }));

    const cities = new Map<string, City>();
    cities.set("city1", makeCity({ id: "city1", factionId: "f1", coord: cityCoord }));

    const state = makeState({ tiles, factions, units, cities });
    const next = processEconomy(state);

    // available = 0 + 0 + BASE_FOOD_PER_CITY(3) - 5 units = -2
    // 2 units should lose 1 strength
    let starvedCount = 0;
    for (const unit of next.units.values()) {
      if (unit.strength < 3) starvedCount++;
    }
    expect(starvedCount).toBe(2);
  });

  it("starvation removes units that reach 0 strength", () => {
    const tiles = new Map<string, Tile>();
    const coord: HexCoord = { q: 0, r: 0 };
    const coord2: HexCoord = { q: -1, r: 0 };
    const coord3: HexCoord = { q: 0, r: -1 };
    const coord4: HexCoord = { q: -1, r: 1 };
    const coord5: HexCoord = { q: 1, r: -1 };
    const cityCoord: HexCoord = { q: 1, r: 0 };
    tiles.set(hexKey(coord), makeTile({ coord, terrain: "desert", owner: "f1" }));
    tiles.set(hexKey(coord2), makeTile({ coord: coord2, terrain: "desert", owner: "f1" }));
    tiles.set(hexKey(coord3), makeTile({ coord: coord3, terrain: "desert", owner: "f1" }));
    tiles.set(hexKey(coord4), makeTile({ coord: coord4, terrain: "desert", owner: "f1" }));
    tiles.set(hexKey(coord5), makeTile({ coord: coord5, terrain: "desert", owner: "f1" }));
    tiles.set(hexKey(cityCoord), makeTile({ coord: cityCoord, terrain: "desert", owner: "f1", cityId: "city1" }));

    const factions = new Map<FactionId, Faction>();
    factions.set("f1", makeFaction({ id: "f1", food: 0, storedFood: 0 }));

    // 5 units with strength 1 each, BASE_FOOD_PER_CITY=3 food, deficit = 2
    const units = new Map<string, Unit>();
    units.set("u1", makeUnit({ id: "u1", factionId: "f1", coord, strength: 1 }));
    units.set("u2", makeUnit({ id: "u2", factionId: "f1", coord: coord2, strength: 1 }));
    units.set("u3", makeUnit({ id: "u3", factionId: "f1", coord: coord3, strength: 1 }));
    units.set("u4", makeUnit({ id: "u4", factionId: "f1", coord: coord4, strength: 1 }));
    units.set("u5", makeUnit({ id: "u5", factionId: "f1", coord: coord5, strength: 1 }));

    const cities = new Map<string, City>();
    cities.set("city1", makeCity({ id: "city1", factionId: "f1", coord: cityCoord }));

    const state = makeState({ tiles, factions, units, cities });
    const next = processEconomy(state);

    // 2 units should be removed (strength 1 - 1 = 0)
    expect(next.units.size).toBe(3);
  });

  it("research accumulates from buildings", () => {
    const tiles = new Map<string, Tile>();
    const coord: HexCoord = { q: 0, r: 0 };
    const cityCoord: HexCoord = { q: 1, r: 0 };
    tiles.set(hexKey(coord), makeTile({
      coord,
      terrain: "plains",
      owner: "f1",
      building: "library",
    }));
    tiles.set(hexKey(cityCoord), makeTile({ coord: cityCoord, terrain: "plains", owner: "f1", cityId: "city1" }));

    const factions = new Map<FactionId, Faction>();
    factions.set("f1", makeFaction({ id: "f1", research: 5 }));

    const cities = new Map<string, City>();
    cities.set("city1", makeCity({ id: "city1", factionId: "f1", coord: cityCoord }));

    const state = makeState({ tiles, factions, cities });
    const next = processEconomy(state);

    expect(next.factions.get("f1")!.research).toBe(5 + BASE_RESEARCH_PER_CITY + BUILDING_STATS.library.researchBonus);
  });

  it("eliminates faction with 0 cities", () => {
    const factions = new Map<FactionId, Faction>();
    factions.set("f1", makeFaction({ id: "f1" }));

    // No cities for f1
    const state = makeState({ factions });
    const next = processEconomy(state);

    expect(next.factions.get("f1")!.alive).toBe(false);
  });

  it("does not process dead factions", () => {
    const factions = new Map<FactionId, Faction>();
    factions.set("f1", makeFaction({ id: "f1", alive: false, gold: 5 }));

    const state = makeState({ factions });
    const next = processEconomy(state);

    // Gold should not change
    expect(next.factions.get("f1")!.gold).toBe(5);
  });
});
