import { describe, it, expect } from "vitest";
import { MockAdapter } from "../mock-adapter";
import { createInitialState } from "@xpoch/engine";

describe("MockAdapter", () => {
  it("returns valid actions", async () => {
    const state = createInitialState(5, 42, [
      { id: "f1", name: "Alpha", modelProvider: "mock", color: "#f00" },
      { id: "f2", name: "Beta", modelProvider: "mock", color: "#0f0" },
    ]);
    const adapter = new MockAdapter();
    const actions = await adapter.decideActions(state, "f1");

    expect(actions.length).toBeGreaterThan(0);
    expect(actions.length).toBeLessThanOrEqual(3);
    for (const action of actions) {
      expect(action.factionId).toBe("f1");
    }
  });
});
