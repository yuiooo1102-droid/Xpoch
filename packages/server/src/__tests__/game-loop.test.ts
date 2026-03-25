import { describe, it, expect, vi } from "vitest";
import { GameLoop } from "../game-loop";
import { MockAdapter } from "@xpoch/ai-adapter";
import { createInitialState } from "@xpoch/engine";

describe("GameLoop", () => {
  it("advances tick and updates state", async () => {
    const factions = [
      { id: "f1", name: "Alpha", modelProvider: "mock", color: "#f00" },
      { id: "f2", name: "Beta", modelProvider: "mock", color: "#0f0" },
    ];
    const adapters = new Map([
      ["f1", new MockAdapter()],
      ["f2", new MockAdapter()],
    ]);
    const initialState = createInitialState(5, 42, factions);

    const onUpdate = vi.fn();
    const loop = new GameLoop(initialState, adapters, onUpdate);

    await loop.tick();

    expect(onUpdate).toHaveBeenCalled();
    const newState = loop.getState();
    expect(newState.tick).toBe(1);
  });

  it("detects winner and stops", async () => {
    const factions = [
      { id: "f1", name: "Alpha", modelProvider: "mock", color: "#f00" },
      { id: "f2", name: "Beta", modelProvider: "mock", color: "#0f0" },
    ];
    const adapters = new Map([
      ["f1", new MockAdapter()],
      ["f2", new MockAdapter()],
    ]);
    let state = createInitialState(5, 42, factions);

    const newFactions = new Map(state.factions);
    newFactions.set("f2", { ...newFactions.get("f2")!, alive: false });
    state = { ...state, factions: newFactions };

    const onUpdate = vi.fn();
    const loop = new GameLoop(state, adapters, onUpdate);

    await loop.tick();
    expect(loop.getState().winner).toBe("f1");
  });
});
