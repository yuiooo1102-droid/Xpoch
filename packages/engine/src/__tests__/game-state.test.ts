import { describe, it, expect } from "vitest";
import {
  createInitialState,
  getTile,
  getArmiesAt,
  getCityAt,
  getFactionCities,
  getFactionArmies,
  getFactionGenerals,
  isFactionAlive,
  getAvailableGenerals,
  setTile,
  addArmy,
  removeArmy,
  updateArmy,
  addCity,
  removeCity,
  updateCity,
  updateFaction,
  updateGeneral,
  addLogEntry,
  advanceTick,
} from "../game-state";
import type { FactionConfig } from "../game-state";
import {
  STARTING_RESOURCES,
  STARTING_GARRISON,
  STARTING_ARMY_TROOPS,
  GENERALS_PER_FACTION,
} from "@xpoch/shared";
import { hexKey, hexNeighbors } from "@xpoch/shared";

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
      expect(faction.resources).toEqual(STARTING_RESOURCES);
      expect(faction.techs).toEqual([]);
    }
  });

  it("creates a capital city for each faction with garrison", () => {
    const state = createInitialState(5, 42, TWO_FACTIONS);
    expect(state.cities.size).toBe(2);

    for (const city of state.cities.values()) {
      expect(city.isCapital).toBe(true);
      expect(city.level).toBe(1);
      expect(city.walls).toBe(0);
      expect(city.garrison).toEqual(STARTING_GARRISON);
      expect(city.trainingQueue).toBeNull();
    }

    const f1Cities = getFactionCities(state, "f1");
    const f2Cities = getFactionCities(state, "f2");
    expect(f1Cities).toHaveLength(1);
    expect(f2Cities).toHaveLength(1);
  });

  it("assigns 3 generals per faction with no duplicates", () => {
    const state = createInitialState(5, 42, TWO_FACTIONS);

    const f1Generals = getFactionGenerals(state, "f1");
    const f2Generals = getFactionGenerals(state, "f2");
    expect(f1Generals).toHaveLength(GENERALS_PER_FACTION);
    expect(f2Generals).toHaveLength(GENERALS_PER_FACTION);

    // No duplicate generals across factions
    const f1Ids = new Set(f1Generals.map((g) => g.id));
    const f2Ids = new Set(f2Generals.map((g) => g.id));
    for (const id of f1Ids) {
      expect(f2Ids.has(id)).toBe(false);
    }

    // All generals are alive and level 1
    for (const general of state.generals.values()) {
      expect(general.alive).toBe(true);
      expect(general.level).toBe(1);
      expect(general.exp).toBe(0);
      expect(general.respawnTick).toBeNull();
    }
  });

  it("creates 1 army per faction led by first general", () => {
    const state = createInitialState(5, 42, TWO_FACTIONS);

    const f1Armies = getFactionArmies(state, "f1");
    const f2Armies = getFactionArmies(state, "f2");
    expect(f1Armies).toHaveLength(1);
    expect(f2Armies).toHaveLength(1);

    for (const army of state.armies.values()) {
      expect(army.troops).toEqual(STARTING_ARMY_TROOPS);
      expect(army.state).toBe("idle");
      expect(army.target).toBeNull();
      // General must belong to same faction
      const general = state.generals.get(army.generalId);
      expect(general).toBeDefined();
      expect(general?.factionId).toBe(army.factionId);
    }
  });

  it("marks capital tile + neighbors as owned by faction", () => {
    const state = createInitialState(5, 42, ONE_FACTION);
    const city = [...state.cities.values()][0];
    const centerTile = getTile(state, city.coord);

    expect(centerTile?.cityId).toBe(city.id);
    expect(centerTile?.owner).toBe("f1");

    // Check surrounding tiles are owned
    let ownedNeighborCount = 0;
    const neighbors = hexNeighbors(city.coord);
    for (const nb of neighbors) {
      const tile = getTile(state, nb);
      if (tile && tile.owner === "f1") {
        ownedNeighborCount++;
      }
    }
    expect(ownedNeighborCount).toBeGreaterThanOrEqual(1);
    expect(ownedNeighborCount).toBeLessThanOrEqual(6);
  });

  it("city center tiles are never water", () => {
    const state = createInitialState(5, 42, TWO_FACTIONS);
    for (const city of state.cities.values()) {
      const tile = getTile(state, city.coord);
      expect(tile?.terrain).not.toBe("water");
    }
  });

  it("faction territoryCount reflects initial territory", () => {
    const state = createInitialState(5, 42, ONE_FACTION);
    const faction = state.factions.get("f1")!;
    // At least 1 (city center), at most 7 (center + 6 neighbors)
    expect(faction.territoryCount).toBeGreaterThanOrEqual(1);
    expect(faction.territoryCount).toBeLessThanOrEqual(7);
  });

  it("getAvailableGenerals excludes generals leading armies", () => {
    const state = createInitialState(5, 42, ONE_FACTION);
    const allGenerals = getFactionGenerals(state, "f1");
    const available = getAvailableGenerals(state, "f1");

    // 1 general is leading the starting army
    expect(available).toHaveLength(allGenerals.length - 1);
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

describe("getArmiesAt", () => {
  it("returns armies at a given coordinate", () => {
    const state = createInitialState(5, 42, ONE_FACTION);
    const someArmy = [...state.armies.values()][0];
    const found = getArmiesAt(state, someArmy.coord);
    expect(found.length).toBeGreaterThanOrEqual(1);
    expect(found.some((a) => a.id === someArmy.id)).toBe(true);
  });

  it("returns empty array for coord with no armies", () => {
    const state = createInitialState(5, 42, ONE_FACTION);
    const found = getArmiesAt(state, { q: 99, r: 99 });
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
    expect(state.tiles).not.toBe(newState.tiles);
  });

  it("returns same state for out-of-bounds coord", () => {
    const state = createInitialState(5, 42, ONE_FACTION);
    const result = setTile(state, { q: 100, r: 100 }, { owner: "f1" });
    expect(result).toBe(state);
  });
});

describe("addArmy / removeArmy / updateArmy", () => {
  it("addArmy adds an army to state", () => {
    const state = createInitialState(5, 42, ONE_FACTION);
    const newArmy = {
      id: "test-army",
      factionId: "f1" as const,
      generalId: "lubu",
      troops: { infantry: 100, cavalry: 0, archer: 0 },
      coord: { q: 0, r: 0 },
      target: null,
      state: "idle" as const,
    };
    const newState = addArmy(state, newArmy);
    expect(newState.armies.get("test-army")).toEqual(newArmy);
    expect(state.armies.has("test-army")).toBe(false);
  });

  it("removeArmy removes an army from state", () => {
    const state = createInitialState(5, 42, ONE_FACTION);
    const armyId = [...state.armies.keys()][0];
    const newState = removeArmy(state, armyId);
    expect(newState.armies.has(armyId)).toBe(false);
    expect(state.armies.has(armyId)).toBe(true);
  });

  it("updateArmy updates army fields immutably", () => {
    const state = createInitialState(5, 42, ONE_FACTION);
    const armyId = [...state.armies.keys()][0];
    const newState = updateArmy(state, armyId, { state: "marching" });
    expect(newState.armies.get(armyId)?.state).toBe("marching");
    expect(state.armies.get(armyId)?.state).toBe("idle");
  });
});

describe("addCity / removeCity / updateCity", () => {
  it("addCity adds a city", () => {
    const state = createInitialState(5, 42, ONE_FACTION);
    const newCity = {
      id: "test-city",
      factionId: "f1" as const,
      name: "Test City",
      coord: { q: 0, r: 0 },
      isCapital: false,
      level: 1,
      walls: 0,
      garrison: { infantry: 0, cavalry: 0, archer: 0 },
      trainingQueue: null,
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

  it("updateCity updates city fields immutably", () => {
    const state = createInitialState(5, 42, ONE_FACTION);
    const cityId = [...state.cities.keys()][0];
    const newState = updateCity(state, cityId, { level: 3 });
    expect(newState.cities.get(cityId)?.level).toBe(3);
    expect(state.cities.get(cityId)?.level).toBe(1);
  });
});

describe("updateFaction", () => {
  it("updates faction fields immutably", () => {
    const state = createInitialState(5, 42, ONE_FACTION);
    const newResources = { gold: 999, food: 999, wood: 999, iron: 999 };
    const newState = updateFaction(state, "f1", { resources: newResources });
    expect(newState.factions.get("f1")?.resources).toEqual(newResources);
    expect(state.factions.get("f1")?.resources).toEqual(STARTING_RESOURCES);
  });
});

describe("updateGeneral", () => {
  it("updates general fields immutably", () => {
    const state = createInitialState(5, 42, ONE_FACTION);
    const generalId = [...state.generals.keys()][0];
    const newState = updateGeneral(state, generalId, { level: 5 });
    expect(newState.generals.get(generalId)?.level).toBe(5);
    expect(state.generals.get(generalId)?.level).toBe(1);
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
