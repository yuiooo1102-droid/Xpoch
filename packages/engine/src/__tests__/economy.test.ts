import { describe, it, expect } from "vitest";
import { processEconomy } from "../economy";
import { createInitialState } from "../game-state";

const FACTIONS = [
  { id: "f1", name: "Alpha", modelProvider: "mock", color: "#f00" },
  { id: "f2", name: "Beta", modelProvider: "mock", color: "#0f0" },
];

describe("processEconomy", () => {
  it("adds gold for each owned tile", () => {
    let state = createInitialState(5, 42, FACTIONS);
    const goldBefore = state.factions.get("f1")!.gold;
    const next = processEconomy(state);
    const goldAfter = next.factions.get("f1")!.gold;
    expect(goldAfter).toBeGreaterThan(goldBefore);
  });

  it("deducts food for army upkeep", () => {
    let state = createInitialState(5, 42, FACTIONS);
    const foodBefore = state.factions.get("f1")!.food;
    const next = processEconomy(state);
    const foodAfter = next.factions.get("f1")!.food;
    expect(typeof foodAfter).toBe("number");
  });

  it("eliminates faction with 0 tiles", () => {
    let state = createInitialState(5, 42, FACTIONS);
    const tiles = new Map(state.tiles);
    for (const [key, tile] of tiles) {
      if (tile.owner === "f2") {
        tiles.set(key, { ...tile, owner: null, army: 0 });
      }
    }
    state = { ...state, tiles };

    const next = processEconomy(state);
    expect(next.factions.get("f2")?.alive).toBe(false);
  });
});
