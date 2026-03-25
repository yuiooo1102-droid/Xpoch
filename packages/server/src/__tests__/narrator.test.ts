import { describe, it, expect } from "vitest";
import { narrate, generateSummary } from "../narrator";
import { createInitialState } from "@xpoch/engine";

describe("narrate", () => {
  it("formats log entry with tick number", () => {
    const state = createInitialState(5, 42, [
      { id: "f1", name: "Alpha", modelProvider: "mock", color: "#f00" },
    ]);
    const entry = { tick: 3, message: "Alpha conquered 1,0", involvedFactions: ["f1"] as readonly string[] };
    const text = narrate(entry, state);
    expect(text).toContain("Tick 3");
    expect(text).toContain("conquered");
  });
});

describe("generateSummary", () => {
  it("includes all alive factions", () => {
    const state = createInitialState(5, 42, [
      { id: "f1", name: "Alpha", modelProvider: "mock", color: "#f00" },
      { id: "f2", name: "Beta", modelProvider: "mock", color: "#0f0" },
    ]);
    const summary = generateSummary(state);
    expect(summary).toContain("Alpha");
    expect(summary).toContain("Beta");
    expect(summary).toContain("Tick 0");
  });
});
