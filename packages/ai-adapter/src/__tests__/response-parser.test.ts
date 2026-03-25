import { describe, it, expect } from "vitest";
import { parseAIResponse } from "../response-parser";

describe("parseAIResponse", () => {
  it("parses valid JSON array of actions", () => {
    const raw = '[{"type":"move","from":"0,0","to":"1,0","amount":3}]';
    const actions = parseAIResponse(raw, "f1");
    expect(actions).toHaveLength(1);
    expect(actions[0].type).toBe("move");
    expect(actions[0].factionId).toBe("f1");
    expect(actions[0].from).toEqual({ q: 0, r: 0 });
  });

  it("handles JSON wrapped in markdown code block", () => {
    const raw = '```json\n[{"type":"pass"}]\n```';
    const actions = parseAIResponse(raw, "f1");
    expect(actions).toHaveLength(1);
    expect(actions[0].type).toBe("pass");
  });

  it("returns pass action for unparseable response", () => {
    const actions = parseAIResponse("I think we should attack!", "f1");
    expect(actions).toHaveLength(1);
    expect(actions[0].type).toBe("pass");
  });

  it("caps actions at MAX_ACTIONS_PER_TURN", () => {
    const raw = JSON.stringify([
      { type: "pass" },
      { type: "pass" },
      { type: "pass" },
      { type: "pass" },
      { type: "pass" },
    ]);
    const actions = parseAIResponse(raw, "f1");
    expect(actions.length).toBeLessThanOrEqual(3);
  });
});
