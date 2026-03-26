import { describe, it, expect } from "vitest";
import {
  assignGenerals,
  processRespawns,
  awardExp,
  killGeneral,
  getGeneralDef,
} from "../general-manager";
import type { GameState, General } from "@xpoch/shared";
import { EXP_PER_LEVEL, GENERAL_RESPAWN_TICKS } from "@xpoch/shared";

function makeMinimalState(overrides: Partial<GameState> = {}): GameState {
  return {
    tick: 0,
    tiles: new Map(),
    armies: new Map(),
    generals: new Map(),
    cities: new Map(),
    factions: new Map(),
    diplomacy: { relations: new Map() },
    log: [],
    winner: null,
    mapSize: 12,
    ...overrides,
  };
}

function makeGeneral(overrides: Partial<General> = {}): General {
  return {
    id: "lubu",
    defId: "lubu",
    factionId: "faction-a",
    name: "吕布",
    level: 1,
    exp: 0,
    alive: true,
    respawnTick: null,
    ...overrides,
  };
}

describe("getGeneralDef", () => {
  it("returns definition for known general", () => {
    const def = getGeneralDef("lubu");
    expect(def).toBeDefined();
    expect(def?.name).toBe("吕布");
    expect(def?.specialty).toBe("cavalry");
  });

  it("returns undefined for unknown general", () => {
    expect(getGeneralDef("nonexistent")).toBeUndefined();
  });
});

describe("assignGenerals", () => {
  it("assigns correct number of generals per faction", () => {
    const factions = ["faction-a", "faction-b"];
    const generals = assignGenerals(factions, 3, 42);

    const factionACounts = [...generals.values()].filter(
      (g) => g.factionId === "faction-a",
    );
    const factionBCounts = [...generals.values()].filter(
      (g) => g.factionId === "faction-b",
    );

    expect(factionACounts).toHaveLength(3);
    expect(factionBCounts).toHaveLength(3);
  });

  it("no duplicate generals across factions", () => {
    const factions = ["faction-a", "faction-b", "faction-c"];
    const generals = assignGenerals(factions, 3, 42);

    const ids = [...generals.keys()];
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it("all generals start at level 1, alive, 0 exp", () => {
    const generals = assignGenerals(["faction-a"], 3, 42);

    for (const general of generals.values()) {
      expect(general.level).toBe(1);
      expect(general.exp).toBe(0);
      expect(general.alive).toBe(true);
      expect(general.respawnTick).toBeNull();
    }
  });

  it("deterministic with same seed", () => {
    const a = assignGenerals(["f1", "f2"], 3, 99);
    const b = assignGenerals(["f1", "f2"], 3, 99);

    const aIds = [...a.keys()];
    const bIds = [...b.keys()];
    expect(aIds).toEqual(bIds);
  });

  it("different results with different seeds", () => {
    const a = assignGenerals(["f1", "f2"], 3, 1);
    const b = assignGenerals(["f1", "f2"], 3, 2);

    const aIds = [...a.keys()];
    const bIds = [...b.keys()];
    // Very unlikely to be identical with different seeds
    expect(aIds).not.toEqual(bIds);
  });

  it("throws if not enough generals in pool", () => {
    expect(() => assignGenerals(["f1", "f2", "f3", "f4"], 3, 42)).toThrow(
      /Not enough generals/,
    );
  });
});

describe("killGeneral", () => {
  it("sets alive to false and respawnTick", () => {
    const general = makeGeneral();
    const state = makeMinimalState({
      tick: 5,
      generals: new Map([[general.id, general]]),
    });

    const result = killGeneral(state, general.id);
    const killed = result.generals.get(general.id)!;

    expect(killed.alive).toBe(false);
    expect(killed.respawnTick).toBe(5 + GENERAL_RESPAWN_TICKS);
  });

  it("returns same state if general not found", () => {
    const state = makeMinimalState();
    const result = killGeneral(state, "nonexistent");
    expect(result).toBe(state);
  });
});

describe("processRespawns", () => {
  it("respawns dead general when tick reaches respawnTick", () => {
    const general = makeGeneral({
      alive: false,
      level: 3,
      respawnTick: 10,
    });
    const state = makeMinimalState({
      tick: 10,
      generals: new Map([[general.id, general]]),
    });

    const result = processRespawns(state);
    const respawned = result.generals.get(general.id)!;

    expect(respawned.alive).toBe(true);
    expect(respawned.respawnTick).toBeNull();
    expect(respawned.level).toBe(2); // level - 1
    expect(respawned.exp).toBe(0);
  });

  it("respawns at minimum level 1", () => {
    const general = makeGeneral({
      alive: false,
      level: 1,
      respawnTick: 5,
    });
    const state = makeMinimalState({
      tick: 5,
      generals: new Map([[general.id, general]]),
    });

    const result = processRespawns(state);
    const respawned = result.generals.get(general.id)!;

    expect(respawned.level).toBe(1);
  });

  it("does not respawn if tick has not reached respawnTick", () => {
    const general = makeGeneral({
      alive: false,
      respawnTick: 10,
    });
    const state = makeMinimalState({
      tick: 8,
      generals: new Map([[general.id, general]]),
    });

    const result = processRespawns(state);
    const stillDead = result.generals.get(general.id)!;

    expect(stillDead.alive).toBe(false);
  });

  it("returns same state reference if nothing to respawn", () => {
    const general = makeGeneral({ alive: true });
    const state = makeMinimalState({
      generals: new Map([[general.id, general]]),
    });

    const result = processRespawns(state);
    expect(result).toBe(state);
  });
});

describe("awardExp", () => {
  it("adds exp to general", () => {
    const general = makeGeneral({ exp: 0 });
    const state = makeMinimalState({
      generals: new Map([[general.id, general]]),
    });

    const result = awardExp(state, general.id, 50);
    const updated = result.generals.get(general.id)!;

    expect(updated.exp).toBe(50);
  });

  it("levels up when exp threshold reached", () => {
    const general = makeGeneral({ level: 1, exp: 0 });
    const state = makeMinimalState({
      generals: new Map([[general.id, general]]),
    });

    // EXP_PER_LEVEL * level 1 = 100
    const result = awardExp(state, general.id, EXP_PER_LEVEL);
    const updated = result.generals.get(general.id)!;

    expect(updated.level).toBe(2);
    expect(updated.exp).toBe(0); // remainder after level up
  });

  it("does not exceed max level", () => {
    const general = makeGeneral({ level: 10, exp: 0 });
    const state = makeMinimalState({
      generals: new Map([[general.id, general]]),
    });

    const result = awardExp(state, general.id, 5000);
    const updated = result.generals.get(general.id)!;

    expect(updated.level).toBe(10);
  });

  it("does not award exp to dead general", () => {
    const general = makeGeneral({ alive: false, exp: 0 });
    const state = makeMinimalState({
      generals: new Map([[general.id, general]]),
    });

    const result = awardExp(state, general.id, 100);
    expect(result).toBe(state);
  });

  it("returns same state if general not found", () => {
    const state = makeMinimalState();
    const result = awardExp(state, "nonexistent", 100);
    expect(result).toBe(state);
  });
});
