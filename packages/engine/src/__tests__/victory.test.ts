import { describe, it, expect } from "vitest";
import { checkVictory } from "../victory";
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
