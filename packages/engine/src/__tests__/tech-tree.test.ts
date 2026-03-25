import { describe, it, expect, beforeEach } from "vitest";
import type { GameState, Faction, Unit } from "@xpoch/shared";
import { TECH_TREE } from "@xpoch/shared";
import { getAvailableTechs, researchTech, hasTech, applyTechEffects } from "../tech-tree";

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

function createMinimalState(overrides: Partial<GameState> = {}): GameState {
  return {
    tick: 0,
    tiles: new Map(),
    units: new Map(),
    cities: new Map(),
    factions: new Map([["f1", createTestFaction()]]),
    wonders: [],
    diplomacy: { relations: new Map() },
    log: [],
    winner: null,
    mapSize: 5,
    ...overrides,
  };
}

describe("getAvailableTechs", () => {
  it("returns ancient era techs with no prerequisites when faction has no techs", () => {
    const state = createMinimalState();
    const available = getAvailableTechs(state, "f1");

    // All ancient era techs have no prerequisites
    const ancientTechs = TECH_TREE.filter((t) => t.era === "ancient");
    expect(available.length).toBe(ancientTechs.length);

    for (const tech of ancientTechs) {
      expect(available.find((t) => t.id === tech.id)).toBeDefined();
    }
  });

  it("excludes already researched techs", () => {
    const faction = createTestFaction({ techs: ["agriculture"] });
    const state = createMinimalState({
      factions: new Map([["f1", faction]]),
    });

    const available = getAvailableTechs(state, "f1");
    expect(available.find((t) => t.id === "agriculture")).toBeUndefined();
  });

  it("does not return techs with unmet prerequisites", () => {
    const state = createMinimalState();
    const available = getAvailableTechs(state, "f1");

    // iron_working requires bronze_working + mining
    expect(available.find((t) => t.id === "iron_working")).toBeUndefined();
  });

  it("unlocks classical techs after researching prerequisites", () => {
    const faction = createTestFaction({ techs: ["bronze_working", "mining"] });
    const state = createMinimalState({
      factions: new Map([["f1", faction]]),
    });

    const available = getAvailableTechs(state, "f1");
    // iron_working requires bronze_working + mining — both met
    expect(available.find((t) => t.id === "iron_working")).toBeDefined();
  });

  it("does not unlock tech when only some prerequisites are met", () => {
    const faction = createTestFaction({ techs: ["bronze_working"] });
    const state = createMinimalState({
      factions: new Map([["f1", faction]]),
    });

    const available = getAvailableTechs(state, "f1");
    // iron_working also requires mining
    expect(available.find((t) => t.id === "iron_working")).toBeUndefined();
  });
});

describe("researchTech", () => {
  it("deducts research points and adds tech to faction", () => {
    const agricultureCost = TECH_TREE.find((t) => t.id === "agriculture")!.cost;
    const state = createMinimalState();

    const result = researchTech(state, "f1", "agriculture");
    expect(result).not.toBeNull();

    const faction = result!.factions.get("f1")!;
    expect(faction.research).toBe(50 - agricultureCost);
    expect(faction.techs).toContain("agriculture");
  });

  it("returns null when research points insufficient", () => {
    const faction = createTestFaction({ research: 1 });
    const state = createMinimalState({
      factions: new Map([["f1", faction]]),
    });

    const result = researchTech(state, "f1", "agriculture");
    expect(result).toBeNull();
  });

  it("returns null when prerequisites not met", () => {
    const state = createMinimalState();

    const result = researchTech(state, "f1", "iron_working");
    expect(result).toBeNull();
  });

  it("returns null when tech already researched", () => {
    const faction = createTestFaction({ techs: ["agriculture"] });
    const state = createMinimalState({
      factions: new Map([["f1", faction]]),
    });

    const result = researchTech(state, "f1", "agriculture");
    expect(result).toBeNull();
  });

  it("adds a log entry when tech is researched", () => {
    const state = createMinimalState();

    const result = researchTech(state, "f1", "agriculture");
    expect(result).not.toBeNull();
    expect(result!.log.length).toBeGreaterThan(0);
    expect(result!.log[0].category).toBe("tech");
    expect(result!.log[0].message).toContain("Agriculture");
  });
});

describe("hasTech", () => {
  it("returns true when faction has the tech", () => {
    const faction = createTestFaction({ techs: ["agriculture"] });
    const state = createMinimalState({
      factions: new Map([["f1", faction]]),
    });

    expect(hasTech(state, "f1", "agriculture")).toBe(true);
  });

  it("returns false when faction does not have the tech", () => {
    const state = createMinimalState();
    expect(hasTech(state, "f1", "agriculture")).toBe(false);
  });
});

describe("applyTechEffects", () => {
  it("upgrades infantry when iron_working is researched", () => {
    const unit = createTestUnit({ type: "infantry", strength: 3, maxStrength: 3 });
    const state = createMinimalState({
      units: new Map([["u1", unit]]),
    });

    const result = applyTechEffects(state, "f1", "iron_working");
    const upgraded = result.units.get("u1")!;
    expect(upgraded.strength).toBe(5);
    expect(upgraded.maxStrength).toBe(5);
    expect(upgraded.upgraded).toBe(true);
  });

  it("upgrades cavalry when horseback_riding is researched", () => {
    const unit = createTestUnit({
      id: "u2",
      type: "cavalry",
      strength: 3,
      maxStrength: 3,
      movement: 2,
      maxMovement: 2,
    });
    const state = createMinimalState({
      units: new Map([["u2", unit]]),
    });

    const result = applyTechEffects(state, "f1", "horseback_riding");
    const upgraded = result.units.get("u2")!;
    expect(upgraded.strength).toBe(5);
    expect(upgraded.movement).toBe(3);
    expect(upgraded.upgraded).toBe(true);
  });

  it("upgrades artillery when gunpowder is researched", () => {
    const unit = createTestUnit({
      id: "u3",
      type: "artillery",
      strength: 4,
      maxStrength: 4,
    });
    const state = createMinimalState({
      units: new Map([["u3", unit]]),
    });

    const result = applyTechEffects(state, "f1", "gunpowder");
    const upgraded = result.units.get("u3")!;
    expect(upgraded.strength).toBe(6);
    expect(upgraded.upgraded).toBe(true);
  });

  it("does not upgrade units belonging to other factions", () => {
    const unit = createTestUnit({ factionId: "f2" });
    const state = createMinimalState({
      units: new Map([["u1", unit]]),
    });

    const result = applyTechEffects(state, "f1", "iron_working");
    const unchanged = result.units.get("u1")!;
    expect(unchanged.strength).toBe(3);
    expect(unchanged.upgraded).toBe(false);
  });

  it("does not re-upgrade already upgraded units", () => {
    const unit = createTestUnit({
      type: "infantry",
      strength: 5,
      maxStrength: 5,
      upgraded: true,
    });
    const state = createMinimalState({
      units: new Map([["u1", unit]]),
    });

    const result = applyTechEffects(state, "f1", "iron_working");
    // Should be unchanged since already upgraded
    expect(result.units.get("u1")).toEqual(unit);
  });
});
