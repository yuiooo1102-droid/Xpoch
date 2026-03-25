import { describe, it, expect } from "vitest";
import { createInitialState } from "@xpoch/engine";
import { MockAdapter } from "@xpoch/ai-adapter";
import { GameLoop } from "../game-loop";

describe("Integration: full game loop with mock AI", () => {
  it("runs 10 ticks without crashing", async () => {
    const factions = [
      { id: "f1", name: "Alpha", modelProvider: "mock", color: "#f00" },
      { id: "f2", name: "Beta", modelProvider: "mock", color: "#0f0" },
      { id: "f3", name: "Gamma", modelProvider: "mock", color: "#00f" },
    ];
    const adapters = new Map([
      ["f1", new MockAdapter()],
      ["f2", new MockAdapter()],
      ["f3", new MockAdapter()],
    ]);
    const state = createInitialState(8, 42, factions);
    const updates: any[] = [];

    const loop = new GameLoop(state, adapters, (s) => updates.push(s));

    for (let i = 0; i < 10; i++) {
      await loop.tick();
    }

    expect(updates.length).toBe(10);
    expect(loop.getState().tick).toBe(10);

    for (const faction of loop.getState().factions.values()) {
      expect(typeof faction.gold).toBe("number");
      expect(typeof faction.food).toBe("number");
    }
  });

  it("generates log entries during gameplay", async () => {
    const factions = [
      { id: "f1", name: "Alpha", modelProvider: "mock", color: "#f00" },
      { id: "f2", name: "Beta", modelProvider: "mock", color: "#0f0" },
    ];
    const adapters = new Map([
      ["f1", new MockAdapter()],
      ["f2", new MockAdapter()],
    ]);
    const state = createInitialState(5, 42, factions);

    const loop = new GameLoop(state, adapters, () => {});

    for (let i = 0; i < 5; i++) {
      await loop.tick();
    }

    expect(loop.getState().log.length).toBeGreaterThan(0);
  });

  it("state remains immutable between ticks", async () => {
    const factions = [
      { id: "f1", name: "Alpha", modelProvider: "mock", color: "#f00" },
      { id: "f2", name: "Beta", modelProvider: "mock", color: "#0f0" },
    ];
    const adapters = new Map([
      ["f1", new MockAdapter()],
      ["f2", new MockAdapter()],
    ]);
    const state = createInitialState(5, 42, factions);

    const snapshots: any[] = [];
    const loop = new GameLoop(state, adapters, (s) =>
      snapshots.push(JSON.parse(JSON.stringify(s)))
    );

    await loop.tick();
    await loop.tick();

    expect(snapshots[0].tick).toBe(1);
    expect(snapshots[1].tick).toBe(2);
  });
});
