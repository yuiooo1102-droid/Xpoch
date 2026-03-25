import { describe, it, expect } from "vitest";
import { checkVictory, checkEliminations } from "../victory";
import { createInitialState } from "../game-state";

const FACTIONS = [
  { id: "f1", name: "Alpha", modelProvider: "mock", color: "#f00" },
  { id: "f2", name: "Beta", modelProvider: "mock", color: "#0f0" },
  { id: "f3", name: "Gamma", modelProvider: "mock", color: "#00f" },
];

describe("checkVictory", () => {
  it("returns null when multiple factions alive", () => {
    const state = createInitialState(5, 42, FACTIONS);
    expect(checkVictory(state)).toBeNull();
  });

  it("returns winner when only one faction alive", () => {
    let state = createInitialState(5, 42, FACTIONS);
    const factions = new Map(state.factions);
    factions.set("f2", { ...factions.get("f2")!, alive: false });
    factions.set("f3", { ...factions.get("f3")!, alive: false });
    state = { ...state, factions };

    expect(checkVictory(state)).toBe("f1");
  });

  it("returns null when no factions alive (draw)", () => {
    let state = createInitialState(5, 42, FACTIONS);
    const factions = new Map(state.factions);
    for (const [id, f] of factions) {
      factions.set(id, { ...f, alive: false });
    }
    state = { ...state, factions };

    expect(checkVictory(state)).toBeNull();
  });
});

describe("checkEliminations", () => {
  it("marks faction without cities as not alive", () => {
    let state = createInitialState(5, 42, FACTIONS);

    // Remove all cities for f2
    const cities = new Map(state.cities);
    for (const [cityId, city] of cities) {
      if (city.factionId === "f2") {
        cities.delete(cityId);
      }
    }
    state = { ...state, cities };

    const result = checkEliminations(state);
    const f2 = result.factions.get("f2")!;
    expect(f2.alive).toBe(false);
  });

  it("disbands units of eliminated factions", () => {
    let state = createInitialState(5, 42, FACTIONS);

    // Remove all cities for f2
    const cities = new Map(state.cities);
    for (const [cityId, city] of cities) {
      if (city.factionId === "f2") {
        cities.delete(cityId);
      }
    }
    state = { ...state, cities };

    const result = checkEliminations(state);
    const f2Units = [...result.units.values()].filter(
      (u) => u.factionId === "f2",
    );
    expect(f2Units).toHaveLength(0);
  });

  it("does not affect factions that still have cities", () => {
    let state = createInitialState(5, 42, FACTIONS);

    // Remove all cities for f2 only
    const cities = new Map(state.cities);
    for (const [cityId, city] of cities) {
      if (city.factionId === "f2") {
        cities.delete(cityId);
      }
    }
    state = { ...state, cities };

    const result = checkEliminations(state);
    expect(result.factions.get("f1")!.alive).toBe(true);
    expect(result.factions.get("f3")!.alive).toBe(true);
  });

  it("returns same state if no eliminations needed", () => {
    const state = createInitialState(5, 42, FACTIONS);
    const result = checkEliminations(state);
    expect(result).toBe(state); // same reference — no change
  });
});
