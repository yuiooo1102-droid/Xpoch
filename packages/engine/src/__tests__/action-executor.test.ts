import { describe, it, expect } from "vitest";
import { executeAction } from "../action-executor";
import { createInitialState, getTile, getFaction } from "../game-state";
import type { Action, GameState } from "@xpoch/shared";

function setupState(): GameState {
  const factions = [
    { id: "f1", name: "Alpha", modelProvider: "mock", color: "#f00" },
    { id: "f2", name: "Beta", modelProvider: "mock", color: "#0f0" },
  ];
  let state = createInitialState(5, 42, factions);

  const tiles = new Map(state.tiles);
  const t00 = tiles.get("0,0")!;
  tiles.set("0,0", { ...t00, owner: "f1", army: 10, terrain: "plains" });
  const t10 = tiles.get("1,0")!;
  tiles.set("1,0", { ...t10, owner: null, army: 0, terrain: "plains" });

  return { ...state, tiles };
}

describe("executeAction", () => {
  it("move transfers army to empty tile", () => {
    const state = setupState();
    const action: Action = {
      factionId: "f1",
      type: "move",
      from: { q: 0, r: 0 },
      to: { q: 1, r: 0 },
      amount: 3,
    };
    const next = executeAction(state, action);
    expect(getTile(next, { q: 0, r: 0 })?.army).toBe(7);
    expect(getTile(next, { q: 1, r: 0 })?.army).toBe(3);
    expect(getTile(next, { q: 1, r: 0 })?.owner).toBe("f1");
  });

  it("recruit adds army and deducts gold", () => {
    const state = setupState();
    const action: Action = {
      factionId: "f1",
      type: "recruit",
      from: { q: 0, r: 0 },
      amount: 2,
    };
    const next = executeAction(state, action);
    expect(getTile(next, { q: 0, r: 0 })?.army).toBe(12);
    expect(getFaction(next, "f1")?.gold).toBe(
      getFaction(state, "f1")!.gold - 20
    );
  });

  it("pass does not change state (except log)", () => {
    const state = setupState();
    const action: Action = { factionId: "f1", type: "pass" };
    const next = executeAction(state, action);
    expect(next.tiles).toEqual(state.tiles);
    expect(next.factions).toEqual(state.factions);
  });
});
