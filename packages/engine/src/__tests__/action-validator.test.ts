import { describe, it, expect } from "vitest";
import {
  validateMilitaryOrder,
  validateCityOrder,
  validateDiplomacyOrder,
} from "../action-validator";
import type {
  GameState,
  Faction,
  Unit,
  City,
  Tile,
  MilitaryOrder,
  CityOrder,
  DiplomacyOrder,
  HexCoord,
} from "@xpoch/shared";
import { hexKey } from "@xpoch/shared";

// === Helpers ===

function createFaction(overrides: Partial<Faction> = {}): Faction {
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

function createUnit(overrides: Partial<Unit> = {}): Unit {
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

function createTile(coord: HexCoord, overrides: Partial<Tile> = {}): Tile {
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

function createState(overrides: Partial<GameState> = {}): GameState {
  const tiles = new Map<string, Tile>();
  for (let q = -2; q <= 2; q++) {
    for (let r = -2; r <= 2; r++) {
      tiles.set(hexKey({ q, r }), createTile({ q, r }));
    }
  }

  return {
    tick: 0,
    tiles,
    units: new Map(),
    cities: new Map(),
    factions: new Map([
      ["f1", createFaction()],
      ["f2", createFaction({ id: "f2", name: "Beta", color: "#0f0" })],
    ]),
    wonders: [],
    diplomacy: { relations: new Map() },
    log: [],
    winner: null,
    mapSize: 5,
    ...overrides,
  };
}

// === Military validation ===

describe("validateMilitaryOrder", () => {
  it("rejects order for non-existent unit", () => {
    const state = createState();
    const order: MilitaryOrder = { unitId: "u1", action: "move", to: { q: 1, r: 0 } };
    const result = validateMilitaryOrder(state, order, "f1");
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("not exist");
  });

  it("rejects order for unit not owned by faction", () => {
    const unit = createUnit({ factionId: "f2" });
    const state = createState({ units: new Map([["u1", unit]]) });
    const order: MilitaryOrder = { unitId: "u1", action: "move", to: { q: 1, r: 0 } };
    const result = validateMilitaryOrder(state, order, "f1");
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("belong");
  });

  it("rejects move to water without navigation tech", () => {
    const unit = createUnit();
    const tiles = new Map<string, Tile>();
    tiles.set(hexKey({ q: 0, r: 0 }), createTile({ q: 0, r: 0 }));
    tiles.set(hexKey({ q: 1, r: 0 }), createTile({ q: 1, r: 0 }, { terrain: "water" }));

    const state = createState({ units: new Map([["u1", unit]]), tiles });
    const order: MilitaryOrder = { unitId: "u1", action: "move", to: { q: 1, r: 0 } };
    const result = validateMilitaryOrder(state, order, "f1");
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("water");
  });

  it("rejects move out of movement range", () => {
    const unit = createUnit({ movement: 1 });
    const state = createState({ units: new Map([["u1", unit]]) });
    const order: MilitaryOrder = { unitId: "u1", action: "move", to: { q: 2, r: 0 } };
    const result = validateMilitaryOrder(state, order, "f1");
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("movement range");
  });

  it("accepts valid move to adjacent empty hex", () => {
    const unit = createUnit();
    const state = createState({ units: new Map([["u1", unit]]) });
    const order: MilitaryOrder = { unitId: "u1", action: "move", to: { q: 1, r: 0 } };
    const result = validateMilitaryOrder(state, order, "f1");
    expect(result.valid).toBe(true);
  });

  it("accepts move into hex with enemy units (executor auto-converts to attack)", () => {
    const unit = createUnit();
    const enemy = createUnit({ id: "u2", factionId: "f2", coord: { q: 1, r: 0 } });
    const state = createState({ units: new Map([["u1", unit], ["u2", enemy]]) });
    const order: MilitaryOrder = { unitId: "u1", action: "move", to: { q: 1, r: 0 } };
    const result = validateMilitaryOrder(state, order, "f1");
    expect(result.valid).toBe(true);
  });

  it("accepts attack on hex with enemy units", () => {
    const unit = createUnit();
    const enemy = createUnit({ id: "u2", factionId: "f2", coord: { q: 1, r: 0 } });
    const state = createState({ units: new Map([["u1", unit], ["u2", enemy]]) });
    const order: MilitaryOrder = { unitId: "u1", action: "attack", to: { q: 1, r: 0 } };
    const result = validateMilitaryOrder(state, order, "f1");
    expect(result.valid).toBe(true);
  });

  it("rejects attack on hex with no enemy presence", () => {
    const unit = createUnit();
    const state = createState({ units: new Map([["u1", unit]]) });
    const order: MilitaryOrder = { unitId: "u1", action: "attack", to: { q: 1, r: 0 } };
    const result = validateMilitaryOrder(state, order, "f1");
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("No enemy");
  });

  it("accepts fortify action", () => {
    const unit = createUnit();
    const state = createState({ units: new Map([["u1", unit]]) });
    const order: MilitaryOrder = { unitId: "u1", action: "fortify" };
    const result = validateMilitaryOrder(state, order, "f1");
    expect(result.valid).toBe(true);
  });
});

// === City validation ===

describe("validateCityOrder", () => {
  it("rejects order for non-existent city", () => {
    const state = createState();
    const order: CityOrder = { cityId: "c1", action: "train", target: "infantry" };
    const result = validateCityOrder(state, order, "f1");
    expect(result.valid).toBe(false);
  });

  it("rejects train when gold is insufficient", () => {
    const faction = createFaction({ gold: 0 });
    const city: City = {
      id: "c1", factionId: "f1", name: "Test", coord: { q: 0, r: 0 },
      isCapital: true, hasWalls: false, production: 0, currentProject: null,
    };
    const state = createState({
      factions: new Map([["f1", faction], ["f2", createFaction({ id: "f2", name: "B", color: "#0f0" })]]),
      cities: new Map([["c1", city]]),
    });
    const order: CityOrder = { cityId: "c1", action: "train", target: "infantry" };
    const result = validateCityOrder(state, order, "f1");
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("gold");
  });

  it("accepts train when gold is sufficient", () => {
    const city: City = {
      id: "c1", factionId: "f1", name: "Test", coord: { q: 0, r: 0 },
      isCapital: true, hasWalls: false, production: 0, currentProject: null,
    };
    const state = createState({ cities: new Map([["c1", city]]) });
    const order: CityOrder = { cityId: "c1", action: "train", target: "infantry" };
    const result = validateCityOrder(state, order, "f1");
    expect(result.valid).toBe(true);
  });

  it("rejects build without required tech", () => {
    const city: City = {
      id: "c1", factionId: "f1", name: "Test", coord: { q: 0, r: 0 },
      isCapital: true, hasWalls: false, production: 0, currentProject: null,
    };
    const state = createState({ cities: new Map([["c1", city]]) });
    const order: CityOrder = { cityId: "c1", action: "build", target: "granary" };
    // granary requires pottery tech
    const result = validateCityOrder(state, order, "f1");
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("tech");
  });
});

// === Diplomacy validation ===

describe("validateDiplomacyOrder", () => {
  it("rejects targeting own faction", () => {
    const state = createState();
    const order: DiplomacyOrder = { action: "declare_war", targetFactionId: "f1" };
    const result = validateDiplomacyOrder(state, order, "f1");
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("own faction");
  });

  it("rejects targeting eliminated faction", () => {
    const deadFaction = createFaction({ id: "f2", name: "Beta", alive: false });
    const state = createState({
      factions: new Map([["f1", createFaction()], ["f2", deadFaction]]),
    });
    const order: DiplomacyOrder = { action: "declare_war", targetFactionId: "f2" };
    const result = validateDiplomacyOrder(state, order, "f1");
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("eliminated");
  });

  it("accepts valid declare_war", () => {
    const state = createState();
    const order: DiplomacyOrder = { action: "declare_war", targetFactionId: "f2" };
    const result = validateDiplomacyOrder(state, order, "f1");
    expect(result.valid).toBe(true);
  });

  it("rejects send_gold without amount", () => {
    const state = createState();
    const order: DiplomacyOrder = { action: "send_gold", targetFactionId: "f2" };
    const result = validateDiplomacyOrder(state, order, "f1");
    expect(result.valid).toBe(false);
  });
});
