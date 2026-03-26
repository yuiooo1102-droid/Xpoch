import { describe, it, expect } from "vitest";
import {
  processMarches,
  estimateMarchTime,
  startMarch,
} from "../march-system";
import type { GameState, Army, General } from "@xpoch/shared";

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

function makeArmy(overrides: Partial<Army> = {}): Army {
  return {
    id: "army-1",
    factionId: "faction-a",
    generalId: "lubu",
    troops: { infantry: 200, cavalry: 100, archer: 100 },
    coord: { q: 0, r: 0 },
    target: null,
    state: "idle",
    ...overrides,
  };
}

function makeGeneral(overrides: Partial<General> = {}): General {
  return {
    id: "lubu",
    defId: "lubu", // baseSpeed = 3
    factionId: "faction-a",
    name: "吕布",
    level: 1,
    exp: 0,
    alive: true,
    respawnTick: null,
    ...overrides,
  };
}

describe("estimateMarchTime", () => {
  it("calculates ticks for a given distance and speed", () => {
    // Distance 6, speed 3 → 2 ticks
    expect(estimateMarchTime({ q: 0, r: 0 }, { q: 6, r: 0 }, 3)).toBe(2);
  });

  it("rounds up for non-even division", () => {
    // Distance 5, speed 3 → ceil(5/3) = 2
    expect(estimateMarchTime({ q: 0, r: 0 }, { q: 5, r: 0 }, 3)).toBe(2);
  });

  it("returns 0 for same position", () => {
    expect(estimateMarchTime({ q: 3, r: 2 }, { q: 3, r: 2 }, 3)).toBe(0);
  });

  it("returns Infinity for speed 0", () => {
    expect(estimateMarchTime({ q: 0, r: 0 }, { q: 1, r: 0 }, 0)).toBe(
      Infinity,
    );
  });

  it("speed 1 means 1 hex per tick", () => {
    expect(estimateMarchTime({ q: 0, r: 0 }, { q: 4, r: 0 }, 1)).toBe(4);
  });
});

describe("startMarch", () => {
  it("sets army target and state to marching", () => {
    const army = makeArmy();
    const state = makeMinimalState({
      armies: new Map([[army.id, army]]),
    });

    const result = startMarch(state, army.id, { q: 5, r: 0 });
    const updated = result.armies.get(army.id)!;

    expect(updated.state).toBe("marching");
    expect(updated.target).toEqual({ q: 5, r: 0 });
  });

  it("returns same state if army not found", () => {
    const state = makeMinimalState();
    const result = startMarch(state, "nonexistent", { q: 5, r: 0 });
    expect(result).toBe(state);
  });

  it("does not mutate original state", () => {
    const army = makeArmy();
    const state = makeMinimalState({
      armies: new Map([[army.id, army]]),
    });

    startMarch(state, army.id, { q: 5, r: 0 });

    // Original unchanged
    expect(state.armies.get(army.id)!.state).toBe("idle");
    expect(state.armies.get(army.id)!.target).toBeNull();
  });
});

describe("processMarches", () => {
  it("moves army toward target by general speed per tick", () => {
    const army = makeArmy({
      coord: { q: 0, r: 0 },
      target: { q: 9, r: 0 },
      state: "marching",
    });
    const general = makeGeneral(); // lubu: baseSpeed = 3

    const state = makeMinimalState({
      armies: new Map([[army.id, army]]),
      generals: new Map([[general.id, general]]),
    });

    const result = processMarches(state);
    const updated = result.armies.get(army.id)!;

    // Should move 3 hexes toward target (speed = 3)
    expect(updated.coord.q).toBe(3);
    expect(updated.coord.r).toBe(0);
    expect(updated.state).toBe("marching");
    expect(updated.target).toEqual({ q: 9, r: 0 });
  });

  it("sets state to idle on arrival", () => {
    const army = makeArmy({
      coord: { q: 0, r: 0 },
      target: { q: 2, r: 0 },
      state: "marching",
    });
    const general = makeGeneral(); // speed 3 >= distance 2

    const state = makeMinimalState({
      armies: new Map([[army.id, army]]),
      generals: new Map([[general.id, general]]),
    });

    const result = processMarches(state);
    const updated = result.armies.get(army.id)!;

    expect(updated.coord).toEqual({ q: 2, r: 0 });
    expect(updated.state).toBe("idle");
    expect(updated.target).toBeNull();
  });

  it("does not move idle armies", () => {
    const army = makeArmy({ state: "idle" });
    const state = makeMinimalState({
      armies: new Map([[army.id, army]]),
    });

    const result = processMarches(state);
    expect(result).toBe(state); // No change
  });

  it("uses speed 1 when no general def found", () => {
    const army = makeArmy({
      coord: { q: 0, r: 0 },
      target: { q: 5, r: 0 },
      state: "marching",
      generalId: "unknown-general",
    });
    // No general in state
    const state = makeMinimalState({
      armies: new Map([[army.id, army]]),
    });

    const result = processMarches(state);
    const updated = result.armies.get(army.id)!;

    // Default speed = 1
    expect(updated.coord.q).toBe(1);
    expect(updated.coord.r).toBe(0);
  });

  it("handles multiple armies independently", () => {
    const army1 = makeArmy({
      id: "army-1",
      generalId: "lubu",
      coord: { q: 0, r: 0 },
      target: { q: 6, r: 0 },
      state: "marching",
    });
    const army2 = makeArmy({
      id: "army-2",
      generalId: "zhuge",
      coord: { q: 0, r: 0 },
      target: { q: 6, r: 0 },
      state: "marching",
    });
    const general1 = makeGeneral({ id: "lubu", defId: "lubu" }); // speed 3
    const general2 = makeGeneral({
      id: "zhuge",
      defId: "zhuge",
      name: "诸葛亮",
    }); // speed 2

    const state = makeMinimalState({
      armies: new Map([
        [army1.id, army1],
        [army2.id, army2],
      ]),
      generals: new Map([
        [general1.id, general1],
        [general2.id, general2],
      ]),
    });

    const result = processMarches(state);

    expect(result.armies.get("army-1")!.coord.q).toBe(3); // lubu speed 3
    expect(result.armies.get("army-2")!.coord.q).toBe(2); // zhuge speed 2
  });

  it("does not mutate original state", () => {
    const army = makeArmy({
      coord: { q: 0, r: 0 },
      target: { q: 5, r: 0 },
      state: "marching",
    });
    const general = makeGeneral();
    const state = makeMinimalState({
      armies: new Map([[army.id, army]]),
      generals: new Map([[general.id, general]]),
    });

    processMarches(state);

    expect(state.armies.get(army.id)!.coord).toEqual({ q: 0, r: 0 });
  });
});
