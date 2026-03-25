import { describe, it, expect } from "vitest";
import { createInitialState, getTile, getFaction, setTileOwner } from "../game-state";

describe("createInitialState", () => {
  const factionConfigs = [
    { id: "f1", name: "Alpha", modelProvider: "mock", color: "#ff0000" },
    { id: "f2", name: "Beta", modelProvider: "mock", color: "#00ff00" },
  ];

  it("creates state with correct number of factions", () => {
    const state = createInitialState(5, 42, factionConfigs);
    expect(state.factions.size).toBe(2);
  });

  it("places each faction on a starting tile", () => {
    const state = createInitialState(5, 42, factionConfigs);
    let ownedByF1 = 0;
    let ownedByF2 = 0;
    for (const tile of state.tiles.values()) {
      if (tile.owner === "f1") ownedByF1++;
      if (tile.owner === "f2") ownedByF2++;
    }
    expect(ownedByF1).toBeGreaterThanOrEqual(1);
    expect(ownedByF2).toBeGreaterThanOrEqual(1);
  });

  it("starts at tick 0 with no winner", () => {
    const state = createInitialState(5, 42, factionConfigs);
    expect(state.tick).toBe(0);
    expect(state.winner).toBeNull();
  });

  it("each faction starts alive with resources", () => {
    const state = createInitialState(5, 42, factionConfigs);
    for (const faction of state.factions.values()) {
      expect(faction.alive).toBe(true);
      expect(faction.gold).toBeGreaterThan(0);
      expect(faction.food).toBeGreaterThan(0);
    }
  });
});

describe("getTile", () => {
  it("returns tile for valid coord", () => {
    const state = createInitialState(5, 42, [
      { id: "f1", name: "A", modelProvider: "mock", color: "#f00" },
    ]);
    const tile = getTile(state, { q: 0, r: 0 });
    expect(tile).toBeDefined();
    expect(tile?.coord).toEqual({ q: 0, r: 0 });
  });

  it("returns undefined for out-of-bounds coord", () => {
    const state = createInitialState(5, 42, [
      { id: "f1", name: "A", modelProvider: "mock", color: "#f00" },
    ]);
    const tile = getTile(state, { q: 100, r: 100 });
    expect(tile).toBeUndefined();
  });
});

describe("setTileOwner", () => {
  it("returns new state with updated tile owner (immutable)", () => {
    const factionConfigs = [
      { id: "f1", name: "A", modelProvider: "mock", color: "#f00" },
    ];
    const state = createInitialState(5, 42, factionConfigs);
    const newState = setTileOwner(state, { q: 0, r: 0 }, "f1", 5);

    const oldTile = getTile(state, { q: 0, r: 0 });
    const newTile = getTile(newState, { q: 0, r: 0 });

    expect(newTile?.owner).toBe("f1");
    expect(newTile?.army).toBe(5);
    expect(oldTile?.owner).not.toBe(newTile?.owner);
  });
});
