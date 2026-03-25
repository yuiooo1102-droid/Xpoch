import { describe, it, expect } from "vitest";
import {
  createInitialState,
  getTile,
  getUnitsAt,
  getCityAt,
  getFactionCities,
  isFactionAlive,
  setTile,
  addUnit,
  removeUnit,
  updateUnit,
  addCity,
  removeCity,
  updateFaction,
  addLogEntry,
  advanceTick,
} from "../game-state";
import type { FactionConfig } from "../game-state";
import { STARTING_GOLD, STARTING_FOOD, STARTING_TECHS, UNIT_STATS } from "@xpoch/shared";

const TWO_FACTIONS: readonly FactionConfig[] = [
  { id: "f1", name: "Alpha", modelProvider: "mock", color: "#ff0000" },
  { id: "f2", name: "Beta", modelProvider: "mock", color: "#00ff00" },
];

const ONE_FACTION: readonly FactionConfig[] = [
  { id: "f1", name: "Alpha", modelProvider: "mock", color: "#ff0000" },
];

describe("createInitialState", () => {
  it("creates state with correct number of factions", () => {
    const state = createInitialState(5, 42, TWO_FACTIONS);
    expect(state.factions.size).toBe(2);
  });

  it("starts at tick 0 with no winner", () => {
    const state = createInitialState(5, 42, TWO_FACTIONS);
    expect(state.tick).toBe(0);
    expect(state.winner).toBeNull();
  });

  it("each faction starts alive with correct starting resources", () => {
    const state = createInitialState(5, 42, TWO_FACTIONS);
    for (const faction of state.factions.values()) {
      expect(faction.alive).toBe(true);
      expect(faction.gold).toBe(STARTING_GOLD);
      expect(faction.food).toBe(STARTING_FOOD);
      expect(faction.techs).toEqual([...STARTING_TECHS]);
      expect(faction.research).toBe(0);
    }
  });

  it("creates a capital city for each faction", () => {
    const state = createInitialState(5, 42, TWO_FACTIONS);
    expect(state.cities.size).toBe(2);

    for (const city of state.cities.values()) {
      expect(city.isCapital).toBe(true);
      expect(city.hasWalls).toBe(false);
      expect(city.production).toBe(0);
      expect(city.currentProject).toBeNull();
    }

    const f1Cities = getFactionCities(state, "f1");
    const f2Cities = getFactionCities(state, "f2");
    expect(f1Cities).toHaveLength(1);
    expect(f2Cities).toHaveLength(1);
  });

  it("places 2 infantry + 1 scout for each faction", () => {
    const state = createInitialState(5, 42, TWO_FACTIONS);

    for (const cfg of TWO_FACTIONS) {
      const factionUnits = [...state.units.values()].filter(
        (u) => u.factionId === cfg.id,
      );
      expect(factionUnits).toHaveLength(3);

      const infantry = factionUnits.filter((u) => u.type === "infantry");
      const scouts = factionUnits.filter((u) => u.type === "scout");
      expect(infantry).toHaveLength(2);
      expect(scouts).toHaveLength(1);
    }
  });

  it("marks city center tile with cityId and outskirts with isCityOutskirt", () => {
    const state = createInitialState(5, 42, ONE_FACTION);
    const city = [...state.cities.values()][0];
    const centerTile = getTile(state, city.coord);

    expect(centerTile?.cityId).toBe(city.id);
    expect(centerTile?.owner).toBe("f1");

    // Check that some surrounding tiles are outskirts
    let outskirtCount = 0;
    for (const tile of state.tiles.values()) {
      if (tile.isCityOutskirt === city.id) {
        outskirtCount++;
        expect(tile.owner).toBe("f1");
      }
    }
    // Up to 6 outskirts (some may be off-map for edge spawns)
    expect(outskirtCount).toBeGreaterThanOrEqual(1);
    expect(outskirtCount).toBeLessThanOrEqual(6);
  });

  it("city center tiles are never water", () => {
    const state = createInitialState(5, 42, TWO_FACTIONS);
    for (const city of state.cities.values()) {
      const tile = getTile(state, city.coord);
      expect(tile?.terrain).not.toBe("water");
    }
  });

  it("unit stats match constants", () => {
    const state = createInitialState(5, 42, ONE_FACTION);
    for (const unit of state.units.values()) {
      const stats = UNIT_STATS[unit.type];
      expect(unit.strength).toBe(stats.strength);
      expect(unit.maxStrength).toBe(stats.strength);
      expect(unit.movement).toBe(stats.movement);
      expect(unit.maxMovement).toBe(stats.movement);
      expect(unit.upgraded).toBe(false);
    }
  });

  it("initializes wonders from WONDER_DEFS", () => {
    const state = createInitialState(5, 42, ONE_FACTION);
    expect(state.wonders.length).toBeGreaterThan(0);
    for (const wonder of state.wonders) {
      expect(wonder.builtBy).toBeNull();
      expect(wonder.cityId).toBeNull();
    }
  });
});

describe("getTile", () => {
  it("returns tile for valid coord", () => {
    const state = createInitialState(5, 42, ONE_FACTION);
    const tile = getTile(state, { q: 0, r: 0 });
    expect(tile).toBeDefined();
    expect(tile?.coord).toEqual({ q: 0, r: 0 });
  });

  it("returns undefined for out-of-bounds coord", () => {
    const state = createInitialState(5, 42, ONE_FACTION);
    const tile = getTile(state, { q: 100, r: 100 });
    expect(tile).toBeUndefined();
  });
});

describe("getUnitsAt", () => {
  it("returns units at a given coordinate", () => {
    const state = createInitialState(5, 42, ONE_FACTION);
    const someUnit = [...state.units.values()][0];
    const found = getUnitsAt(state, someUnit.coord);
    expect(found.length).toBeGreaterThanOrEqual(1);
    expect(found.some((u) => u.id === someUnit.id)).toBe(true);
  });

  it("returns empty array for coord with no units", () => {
    const state = createInitialState(5, 42, ONE_FACTION);
    const found = getUnitsAt(state, { q: 99, r: 99 });
    expect(found).toEqual([]);
  });
});

describe("getCityAt", () => {
  it("returns city at city center coordinate", () => {
    const state = createInitialState(5, 42, ONE_FACTION);
    const city = [...state.cities.values()][0];
    const found = getCityAt(state, city.coord);
    expect(found).toBeDefined();
    expect(found?.id).toBe(city.id);
  });

  it("returns undefined at coord with no city", () => {
    const state = createInitialState(5, 42, ONE_FACTION);
    expect(getCityAt(state, { q: 99, r: 99 })).toBeUndefined();
  });
});

describe("isFactionAlive", () => {
  it("returns true when faction has cities", () => {
    const state = createInitialState(5, 42, TWO_FACTIONS);
    expect(isFactionAlive(state, "f1")).toBe(true);
  });

  it("returns false when faction has no cities", () => {
    let state = createInitialState(5, 42, TWO_FACTIONS);
    // Remove all f2 cities
    const f2Cities = getFactionCities(state, "f2");
    for (const city of f2Cities) {
      state = removeCity(state, city.id);
    }
    expect(isFactionAlive(state, "f2")).toBe(false);
  });
});

describe("setTile", () => {
  it("returns new state with updated tile (immutable)", () => {
    const state = createInitialState(5, 42, ONE_FACTION);
    const coord = { q: 0, r: 0 };
    const newState = setTile(state, coord, { owner: "f1" });

    expect(getTile(newState, coord)?.owner).toBe("f1");
    // Original state may or may not have owner depending on spawn
    expect(state.tiles).not.toBe(newState.tiles);
  });

  it("returns same state for out-of-bounds coord", () => {
    const state = createInitialState(5, 42, ONE_FACTION);
    const result = setTile(state, { q: 100, r: 100 }, { owner: "f1" });
    expect(result).toBe(state);
  });
});

describe("addUnit / removeUnit / updateUnit", () => {
  it("addUnit adds a unit to state", () => {
    const state = createInitialState(5, 42, ONE_FACTION);
    const newUnit = {
      id: "test-unit",
      factionId: "f1",
      type: "infantry" as const,
      coord: { q: 0, r: 0 },
      strength: 3,
      maxStrength: 3,
      movement: 1,
      maxMovement: 1,
      upgraded: false,
    };
    const newState = addUnit(state, newUnit);
    expect(newState.units.get("test-unit")).toEqual(newUnit);
    expect(state.units.has("test-unit")).toBe(false);
  });

  it("removeUnit removes a unit from state", () => {
    const state = createInitialState(5, 42, ONE_FACTION);
    const unitId = [...state.units.keys()][0];
    const newState = removeUnit(state, unitId);
    expect(newState.units.has(unitId)).toBe(false);
    expect(state.units.has(unitId)).toBe(true);
  });

  it("updateUnit updates unit fields immutably", () => {
    const state = createInitialState(5, 42, ONE_FACTION);
    const unitId = [...state.units.keys()][0];
    const newState = updateUnit(state, unitId, { strength: 99 });
    expect(newState.units.get(unitId)?.strength).toBe(99);
    expect(state.units.get(unitId)?.strength).not.toBe(99);
  });
});

describe("addCity / removeCity", () => {
  it("addCity adds a city", () => {
    const state = createInitialState(5, 42, ONE_FACTION);
    const newCity = {
      id: "test-city",
      factionId: "f1",
      name: "Test City",
      coord: { q: 0, r: 0 },
      isCapital: false,
      hasWalls: false,
      production: 0,
      currentProject: null,
    };
    const newState = addCity(state, newCity);
    expect(newState.cities.get("test-city")).toEqual(newCity);
  });

  it("removeCity removes a city", () => {
    const state = createInitialState(5, 42, ONE_FACTION);
    const cityId = [...state.cities.keys()][0];
    const newState = removeCity(state, cityId);
    expect(newState.cities.has(cityId)).toBe(false);
    expect(state.cities.has(cityId)).toBe(true);
  });
});

describe("updateFaction", () => {
  it("updates faction fields immutably", () => {
    const state = createInitialState(5, 42, ONE_FACTION);
    const newState = updateFaction(state, "f1", { gold: 999 });
    expect(newState.factions.get("f1")?.gold).toBe(999);
    expect(state.factions.get("f1")?.gold).toBe(STARTING_GOLD);
  });
});

describe("addLogEntry", () => {
  it("appends log entry with correct tick and category", () => {
    const state = createInitialState(5, 42, ONE_FACTION);
    const newState = addLogEntry(state, "Test message", "system", ["f1"]);
    expect(newState.log).toHaveLength(1);
    expect(newState.log[0].message).toBe("Test message");
    expect(newState.log[0].category).toBe("system");
    expect(newState.log[0].tick).toBe(0);
    expect(newState.log[0].involvedFactions).toEqual(["f1"]);
    // Original unchanged
    expect(state.log).toHaveLength(0);
  });
});

describe("advanceTick", () => {
  it("increments tick by 1", () => {
    const state = createInitialState(5, 42, ONE_FACTION);
    const newState = advanceTick(state);
    expect(newState.tick).toBe(1);
    expect(state.tick).toBe(0);
  });
});
