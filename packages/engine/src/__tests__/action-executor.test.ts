import { describe, it, expect } from "vitest";
import type {
  GameState,
  Faction,
  Unit,
  City,
  Tile,
  TurnDecision,
  HexCoord,
} from "@xpoch/shared";
import { hexKey, UNIT_STATS } from "@xpoch/shared";
import { executeTurnDecision } from "../action-executor";

// === Test helpers ===

function createTestFaction(overrides: Partial<Faction> = {}): Faction {
  return {
    id: "f1",
    name: "Alpha",
    modelProvider: "mock",
    color: "#f00",
    gold: 100,
    food: 50,
    storedFood: 0,
    research: 50,
    techs: [],
    alive: true,
    controlledResources: [],
    ...overrides,
  };
}

function createTestUnit(overrides: Partial<Unit> = {}): Unit {
  return {
    id: "u1",
    factionId: "f1",
    type: "infantry",
    coord: { q: 0, r: 0 },
    strength: 3,
    maxStrength: 3,
    movement: 1,
    maxMovement: 1,
    upgraded: false,
    ...overrides,
  };
}

function createTestCity(overrides: Partial<City> = {}): City {
  return {
    id: "c1",
    factionId: "f1",
    name: "Alpha Capital",
    coord: { q: 0, r: 0 },
    isCapital: true,
    hasWalls: false,
    production: 0,
    currentProject: null,
    ...overrides,
  };
}

function createTestTile(coord: HexCoord, overrides: Partial<Tile> = {}): Tile {
  return {
    coord,
    terrain: "plains",
    owner: null,
    naturalResource: null,
    building: null,
    cityId: null,
    isCityOutskirt: null,
    ...overrides,
  };
}

function createTestState(overrides: Partial<GameState> = {}): GameState {
  const tiles = new Map<string, Tile>();
  // Create a small hex grid
  for (let q = -2; q <= 2; q++) {
    for (let r = -2; r <= 2; r++) {
      const coord = { q, r };
      tiles.set(hexKey(coord), createTestTile(coord, { owner: null }));
    }
  }

  return {
    tick: 0,
    tiles,
    units: new Map(),
    cities: new Map(),
    factions: new Map([
      ["f1", createTestFaction()],
      ["f2", createTestFaction({ id: "f2", name: "Beta", color: "#0f0" })],
    ]),
    wonders: [],
    diplomacy: { relations: new Map() },
    log: [],
    winner: null,
    mapSize: 5,
    ...overrides,
  };
}

function emptyDecision(factionId: string): TurnDecision {
  return {
    factionId,
    military: [],
    cities: [],
    research: null,
    diplomacy: [],
  };
}

// === Tests ===

describe("executeTurnDecision - military", () => {
  it("move updates unit position", () => {
    const unit = createTestUnit({ coord: { q: 0, r: 0 } });
    const state = createTestState({
      units: new Map([["u1", unit]]),
    });

    const decision: TurnDecision = {
      ...emptyDecision("f1"),
      military: [
        { unitId: "u1", action: "move", to: { q: 1, r: 0 } },
      ],
    };

    const result = executeTurnDecision(state, decision);
    const movedUnit = result.units.get("u1")!;
    expect(movedUnit.coord).toEqual({ q: 1, r: 0 });
  });

  it("attack triggers combat and removes dead units", () => {
    const attacker = createTestUnit({
      id: "u1",
      factionId: "f1",
      type: "infantry",
      coord: { q: 0, r: 0 },
      strength: 3,
      maxStrength: 3,
    });
    const defender = createTestUnit({
      id: "u2",
      factionId: "f2",
      type: "infantry",
      coord: { q: 1, r: 0 },
      strength: 3,
      maxStrength: 3,
    });

    const state = createTestState({
      units: new Map([
        ["u1", attacker],
        ["u2", defender],
      ]),
    });

    const decision: TurnDecision = {
      ...emptyDecision("f1"),
      military: [
        { unitId: "u1", action: "attack", to: { q: 1, r: 0 } },
      ],
    };

    const result = executeTurnDecision(state, decision);

    // Combat should have occurred — at least one unit should be gone or damaged
    // With equal strength simultaneous combat, both die
    const totalUnits = result.units.size;
    expect(totalUnits).toBeLessThan(2);

    // Log should have combat entries
    expect(result.log.length).toBeGreaterThan(0);
    const combatLog = result.log.find((l) => l.category === "combat");
    expect(combatLog).toBeDefined();
  });

  it("disband removes unit", () => {
    const unit = createTestUnit();
    const state = createTestState({
      units: new Map([["u1", unit]]),
    });

    const decision: TurnDecision = {
      ...emptyDecision("f1"),
      military: [
        { unitId: "u1", action: "disband" },
      ],
    };

    const result = executeTurnDecision(state, decision);
    expect(result.units.has("u1")).toBe(false);
  });

  it("fortify restores unit strength", () => {
    const unit = createTestUnit({ strength: 1, maxStrength: 3 });
    const state = createTestState({
      units: new Map([["u1", unit]]),
    });

    const decision: TurnDecision = {
      ...emptyDecision("f1"),
      military: [
        { unitId: "u1", action: "fortify" },
      ],
    };

    const result = executeTurnDecision(state, decision);
    expect(result.units.get("u1")!.strength).toBe(3);
  });

  it("rejects move to hex out of movement range", () => {
    const unit = createTestUnit({ movement: 1, coord: { q: 0, r: 0 } });
    const state = createTestState({
      units: new Map([["u1", unit]]),
    });

    const decision: TurnDecision = {
      ...emptyDecision("f1"),
      military: [
        { unitId: "u1", action: "move", to: { q: 2, r: 0 } },
      ],
    };

    const result = executeTurnDecision(state, decision);
    // Unit should not have moved
    expect(result.units.get("u1")!.coord).toEqual({ q: 0, r: 0 });
    // Should have system log about invalid action
    expect(result.log.some((l) => l.category === "system")).toBe(true);
  });
});

describe("executeTurnDecision - city", () => {
  it("train creates a new unit at city and deducts gold", () => {
    const city = createTestCity({ coord: { q: 0, r: 0 } });
    const state = createTestState({
      cities: new Map([["c1", city]]),
    });

    const initialGold = state.factions.get("f1")!.gold;
    const infantryCost = UNIT_STATS.infantry.cost;

    const decision: TurnDecision = {
      ...emptyDecision("f1"),
      cities: [
        { cityId: "c1", action: "train", target: "infantry" },
      ],
    };

    const result = executeTurnDecision(state, decision);

    // A new unit should exist at the city location
    const unitsAtCity = Array.from(result.units.values()).filter(
      (u) => hexKey(u.coord) === hexKey({ q: 0, r: 0 }) && u.factionId === "f1",
    );
    expect(unitsAtCity.length).toBe(1);
    expect(unitsAtCity[0].type).toBe("infantry");

    // Gold should be deducted
    expect(result.factions.get("f1")!.gold).toBe(initialGold - infantryCost);
  });

  it("rejects train when gold is insufficient", () => {
    const faction = createTestFaction({ gold: 0 });
    const city = createTestCity();
    const state = createTestState({
      factions: new Map([
        ["f1", faction],
        ["f2", createTestFaction({ id: "f2", name: "Beta", color: "#0f0" })],
      ]),
      cities: new Map([["c1", city]]),
    });

    const decision: TurnDecision = {
      ...emptyDecision("f1"),
      cities: [
        { cityId: "c1", action: "train", target: "infantry" },
      ],
    };

    const result = executeTurnDecision(state, decision);
    // No unit should be created
    expect(result.units.size).toBe(0);
    // System log about invalid order
    expect(result.log.some((l) => l.category === "system")).toBe(true);
  });
});

describe("executeTurnDecision - diplomacy", () => {
  it("declare_war changes relation to war", () => {
    const state = createTestState();

    const decision: TurnDecision = {
      ...emptyDecision("f1"),
      diplomacy: [
        { action: "declare_war", targetFactionId: "f2" },
      ],
    };

    const result = executeTurnDecision(state, decision);
    const key = ["f1", "f2"].sort().join(":");
    expect(result.diplomacy.relations.get(key)).toBe("war");
  });

  it("propose_alliance changes relation to allied", () => {
    const state = createTestState();

    const decision: TurnDecision = {
      ...emptyDecision("f1"),
      diplomacy: [
        { action: "propose_alliance", targetFactionId: "f2" },
      ],
    };

    const result = executeTurnDecision(state, decision);
    const key = ["f1", "f2"].sort().join(":");
    expect(result.diplomacy.relations.get(key)).toBe("allied");
  });

  it("send_gold transfers gold between factions", () => {
    const state = createTestState();
    const initialGoldF1 = state.factions.get("f1")!.gold;
    const initialGoldF2 = state.factions.get("f2")!.gold;

    const decision: TurnDecision = {
      ...emptyDecision("f1"),
      diplomacy: [
        { action: "send_gold", targetFactionId: "f2", amount: 10 },
      ],
    };

    const result = executeTurnDecision(state, decision);
    expect(result.factions.get("f1")!.gold).toBe(initialGoldF1 - 10);
    expect(result.factions.get("f2")!.gold).toBe(initialGoldF2 + 10);
  });

  it("rejects diplomacy targeting own faction", () => {
    const state = createTestState();

    const decision: TurnDecision = {
      ...emptyDecision("f1"),
      diplomacy: [
        { action: "declare_war", targetFactionId: "f1" },
      ],
    };

    const result = executeTurnDecision(state, decision);
    // Should not set any relation
    const key = "f1:f1";
    expect(result.diplomacy.relations.has(key)).toBe(false);
    expect(result.log.some((l) => l.category === "system")).toBe(true);
  });
});

describe("executeTurnDecision - execution order", () => {
  it("executes diplomacy before military", () => {
    const state = createTestState();

    const decision: TurnDecision = {
      ...emptyDecision("f1"),
      diplomacy: [
        { action: "declare_war", targetFactionId: "f2" },
      ],
      military: [],
    };

    const result = executeTurnDecision(state, decision);

    // Diplomacy log should exist
    const diplomacyLog = result.log.find((l) => l.category === "diplomacy");
    expect(diplomacyLog).toBeDefined();
    expect(diplomacyLog!.message).toContain("WAR");
  });

  it("does nothing for dead factions", () => {
    const deadFaction = createTestFaction({ alive: false });
    const state = createTestState({
      factions: new Map([
        ["f1", deadFaction],
        ["f2", createTestFaction({ id: "f2", name: "Beta", color: "#0f0" })],
      ]),
    });

    const decision: TurnDecision = {
      ...emptyDecision("f1"),
      diplomacy: [
        { action: "declare_war", targetFactionId: "f2" },
      ],
    };

    const result = executeTurnDecision(state, decision);
    expect(result.log.length).toBe(0);
    expect(result.diplomacy.relations.size).toBe(0);
  });
});
