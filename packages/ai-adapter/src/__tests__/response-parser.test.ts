import { describe, it, expect } from "vitest";
import { parseAIResponse } from "../response-parser";

describe("parseAIResponse", () => {
  it("parses valid TurnDecision JSON", () => {
    const raw = JSON.stringify({
      military: [
        { unit_id: "f1-unit-1", action: "move", to: "3,-2" },
        { unit_id: "f1-unit-2", action: "attack", to: "1,0" },
      ],
      cities: [
        { city_id: "f1-city-0", action: "train", unit_type: "infantry" },
      ],
      research: "agriculture",
      diplomacy: [
        { action: "declare_war", target: "f2" },
      ],
    });

    const decision = parseAIResponse(raw, "f1");

    expect(decision.factionId).toBe("f1");
    expect(decision.military).toHaveLength(2);
    expect(decision.military[0].unitId).toBe("f1-unit-1");
    expect(decision.military[0].action).toBe("move");
    expect(decision.military[0].to).toEqual({ q: 3, r: -2 });
    expect(decision.military[1].action).toBe("attack");
    expect(decision.cities).toHaveLength(1);
    expect(decision.cities[0].cityId).toBe("f1-city-0");
    expect(decision.cities[0].action).toBe("train");
    expect(decision.cities[0].target).toBe("infantry");
    expect(decision.research).toBe("agriculture");
    expect(decision.diplomacy).toHaveLength(1);
    expect(decision.diplomacy[0].action).toBe("declare_war");
    expect(decision.diplomacy[0].targetFactionId).toBe("f2");
  });

  it("handles markdown-wrapped JSON", () => {
    const raw = '```json\n{"military": [], "cities": [], "research": null, "diplomacy": []}\n```';
    const decision = parseAIResponse(raw, "f1");

    expect(decision.factionId).toBe("f1");
    expect(decision.military).toEqual([]);
    expect(decision.cities).toEqual([]);
    expect(decision.research).toBeNull();
    expect(decision.diplomacy).toEqual([]);
  });

  it("returns pass decision on parse failure", () => {
    const decision = parseAIResponse("I think we should attack!", "f1");

    expect(decision.factionId).toBe("f1");
    expect(decision.military).toEqual([]);
    expect(decision.cities).toEqual([]);
    expect(decision.research).toBeNull();
    expect(decision.diplomacy).toEqual([]);
  });

  it("returns pass decision for array input (wrong shape)", () => {
    const raw = '[{"type":"move"}]';
    const decision = parseAIResponse(raw, "f1");

    expect(decision.military).toEqual([]);
    expect(decision.research).toBeNull();
  });

  it("skips invalid military orders", () => {
    const raw = JSON.stringify({
      military: [
        { unit_id: "u1", action: "move", to: "1,0" },
        { action: "move", to: "1,0" }, // missing unit_id
        { unit_id: "u2", action: "invalid_action" }, // bad action
      ],
      cities: [],
      research: null,
      diplomacy: [],
    });

    const decision = parseAIResponse(raw, "f1");
    expect(decision.military).toHaveLength(1);
    expect(decision.military[0].unitId).toBe("u1");
  });

  it("parses hex coords from strings like '3,-2'", () => {
    const raw = JSON.stringify({
      military: [{ unit_id: "u1", action: "move", to: "3,-2" }],
      cities: [],
      research: null,
      diplomacy: [],
    });

    const decision = parseAIResponse(raw, "f1");
    expect(decision.military[0].to).toEqual({ q: 3, r: -2 });
  });

  it("fills defaults for missing optional fields", () => {
    const raw = JSON.stringify({
      military: [{ unit_id: "u1", action: "fortify" }],
    });

    const decision = parseAIResponse(raw, "f1");
    expect(decision.factionId).toBe("f1");
    expect(decision.military).toHaveLength(1);
    expect(decision.cities).toEqual([]);
    expect(decision.research).toBeNull();
    expect(decision.diplomacy).toEqual([]);
  });
});
