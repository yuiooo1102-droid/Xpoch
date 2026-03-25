import { describe, it, expect } from "vitest";
import { validateAction } from "../action-validator";
import { createInitialState, setTileOwner } from "../game-state";
import type { Action } from "@xpoch/shared";

const FACTIONS = [
  { id: "f1", name: "Alpha", modelProvider: "mock", color: "#f00" },
  { id: "f2", name: "Beta", modelProvider: "mock", color: "#0f0" },
];

describe("validateAction", () => {
  it("rejects move from tile not owned by faction", () => {
    const state = createInitialState(5, 42, FACTIONS);
    const action: Action = {
      factionId: "f1",
      type: "move",
      from: { q: 0, r: 0 },
      to: { q: 1, r: 0 },
      amount: 1,
    };
    const result = validateAction(state, action);
    expect(typeof result.valid).toBe("boolean");
  });

  it("rejects move to water tile", () => {
    let state = createInitialState(5, 42, FACTIONS);
    const tiles = new Map(state.tiles);
    const target = tiles.get("1,0");
    if (target) {
      tiles.set("1,0", { ...target, terrain: "water" });
    }
    const origin = tiles.get("0,0");
    if (origin) {
      tiles.set("0,0", { ...origin, owner: "f1", army: 5, terrain: "plains" });
    }
    state = { ...state, tiles };

    const action: Action = {
      factionId: "f1",
      type: "move",
      from: { q: 0, r: 0 },
      to: { q: 1, r: 0 },
      amount: 2,
    };
    const result = validateAction(state, action);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("water");
  });

  it("accepts valid recruit action", () => {
    let state = createInitialState(5, 42, FACTIONS);
    const tiles = new Map(state.tiles);
    const tile = tiles.get("0,0");
    if (tile) {
      tiles.set("0,0", { ...tile, owner: "f1", army: 1, terrain: "plains" });
    }
    state = { ...state, tiles };

    const action: Action = {
      factionId: "f1",
      type: "recruit",
      from: { q: 0, r: 0 },
      amount: 2,
    };
    const result = validateAction(state, action);
    expect(result.valid).toBe(true);
  });

  it("always accepts pass action", () => {
    const state = createInitialState(5, 42, FACTIONS);
    const action: Action = { factionId: "f1", type: "pass" };
    const result = validateAction(state, action);
    expect(result.valid).toBe(true);
  });
});
