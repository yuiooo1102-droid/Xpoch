import { describe, it, expect } from "vitest";
import { parseAIResponse } from "../response-parser";

describe("parseAIResponse", () => {
  it("parses valid TurnDecision JSON", () => {
    const raw = JSON.stringify({
      armies: [
        { generalId: "lubu", action: "march", target: { q: 3, r: -2 } },
        { generalId: "guanyu", action: "attack", target: { q: 1, r: 0 } },
      ],
      cities: [
        { city_id: "f1-city-1", action: "train", troop_type: "infantry", amount: 100 },
      ],
      build: [
        { hex: { q: 2, r: 1 }, building: "farm" },
      ],
      research: "agriculture",
      diplomacy: [
        { action: "declare_war", target: "f2" },
      ],
    });

    const decision = parseAIResponse(raw, "f1");

    expect(decision.factionId).toBe("f1");
    expect(decision.armies).toHaveLength(2);
    expect(decision.armies[0].generalId).toBe("lubu");
    expect(decision.armies[0].action).toBe("march");
    expect(decision.armies[0].target).toEqual({ q: 3, r: -2 });
    expect(decision.armies[1].action).toBe("attack");
    expect(decision.cities).toHaveLength(1);
    expect(decision.cities[0].cityId).toBe("f1-city-1");
    expect(decision.cities[0].action).toBe("train");
    expect(decision.cities[0].troopType).toBe("infantry");
    expect(decision.build).toHaveLength(1);
    expect(decision.build[0].building).toBe("farm");
    expect(decision.research).toBe("agriculture");
    expect(decision.diplomacy).toHaveLength(1);
    expect(decision.diplomacy[0].action).toBe("declare_war");
    expect(decision.diplomacy[0].targetFactionId).toBe("f2");
  });

  it("handles markdown-wrapped JSON", () => {
    const raw = '```json\n{"armies": [], "cities": [], "build": [], "research": null, "diplomacy": []}\n```';
    const decision = parseAIResponse(raw, "f1");

    expect(decision.factionId).toBe("f1");
    expect(decision.armies).toEqual([]);
    expect(decision.cities).toEqual([]);
    expect(decision.build).toEqual([]);
    expect(decision.research).toBeNull();
    expect(decision.diplomacy).toEqual([]);
  });

  it("returns pass decision on parse failure", () => {
    const decision = parseAIResponse("I think we should attack!", "f1");

    expect(decision.factionId).toBe("f1");
    expect(decision.armies).toEqual([]);
    expect(decision.cities).toEqual([]);
    expect(decision.build).toEqual([]);
    expect(decision.research).toBeNull();
    expect(decision.diplomacy).toEqual([]);
  });

  it("returns pass decision for array input (wrong shape)", () => {
    const raw = '[{"type":"move"}]';
    const decision = parseAIResponse(raw, "f1");

    expect(decision.armies).toEqual([]);
    expect(decision.research).toBeNull();
  });

  it("skips invalid army orders", () => {
    const raw = JSON.stringify({
      armies: [
        { generalId: "lubu", action: "march", target: { q: 1, r: 0 } },
        { action: "march", target: { q: 1, r: 0 } }, // missing generalId
        { generalId: "guanyu", action: "invalid_action" }, // bad action
      ],
      cities: [],
      build: [],
      research: null,
      diplomacy: [],
    });

    const decision = parseAIResponse(raw, "f1");
    expect(decision.armies).toHaveLength(1);
    expect(decision.armies[0].generalId).toBe("lubu");
  });

  it("parses hex coords from string format '3,-2'", () => {
    const raw = JSON.stringify({
      armies: [{ generalId: "lubu", action: "march", target: "3,-2" }],
      cities: [],
      build: [],
      research: null,
      diplomacy: [],
    });

    const decision = parseAIResponse(raw, "f1");
    expect(decision.armies[0].target).toEqual({ q: 3, r: -2 });
  });

  it("fills defaults for missing optional fields", () => {
    const raw = JSON.stringify({
      armies: [{ generalId: "lubu", action: "idle" }],
    });

    const decision = parseAIResponse(raw, "f1");
    expect(decision.factionId).toBe("f1");
    expect(decision.armies).toHaveLength(1);
    expect(decision.cities).toEqual([]);
    expect(decision.build).toEqual([]);
    expect(decision.research).toBeNull();
    expect(decision.diplomacy).toEqual([]);
  });
});
