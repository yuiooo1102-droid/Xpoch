import { describe, it, expect } from "vitest";
import { MockAdapter } from "../mock-adapter";
import { createInitialState } from "@xpoch/engine";
import type { TurnDecision } from "@xpoch/shared";

describe("MockAdapter", () => {
  const state = createInitialState(5, 42, [
    { id: "f1", name: "Alpha", modelProvider: "mock", color: "#f00" },
    { id: "f2", name: "Beta", modelProvider: "mock", color: "#0f0" },
  ]);

  it("returns valid TurnDecision", async () => {
    const adapter = new MockAdapter();
    const decision: TurnDecision = await adapter.decideActions(state, "f1");

    expect(decision.factionId).toBe("f1");
    expect(Array.isArray(decision.armies)).toBe(true);
    expect(Array.isArray(decision.cities)).toBe(true);
    expect(Array.isArray(decision.diplomacy)).toBe(true);
  });

  it("produces army orders for owned armies", async () => {
    const adapter = new MockAdapter();
    const decision = await adapter.decideActions(state, "f1");

    expect(decision.armies.length).toBeGreaterThan(0);
    for (const order of decision.armies) {
      expect(order.generalId).toBeDefined();
      expect(["march", "attack", "retreat", "garrison", "idle"]).toContain(order.action);
    }
  });

  it("produces city orders for owned cities", async () => {
    const adapter = new MockAdapter();
    const decision = await adapter.decideActions(state, "f1");

    expect(decision.cities.length).toBeGreaterThan(0);
    for (const order of decision.cities) {
      expect(order.cityId).toBeDefined();
      expect(["train", "upgrade_walls", "upgrade_city", "idle"]).toContain(order.action);
    }
  });

  it("picks a research tech", async () => {
    const adapter = new MockAdapter();
    const decision = await adapter.decideActions(state, "f1");

    // Should pick one of the available techs (cheapest)
    expect(decision.research).toBeTruthy();
    expect(typeof decision.research).toBe("string");
  });
});
