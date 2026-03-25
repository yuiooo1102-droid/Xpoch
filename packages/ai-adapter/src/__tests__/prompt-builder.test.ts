import { describe, it, expect } from "vitest";
import { buildPrompt } from "../prompt-builder";
import { createInitialState } from "@xpoch/engine";

describe("buildPrompt", () => {
  const state = createInitialState(5, 42, [
    { id: "f1", name: "Alpha", modelProvider: "mock", color: "#f00" },
    { id: "f2", name: "Beta", modelProvider: "mock", color: "#0f0" },
  ]);

  it("includes faction name in prompt", () => {
    const prompt = buildPrompt(state, "f1");
    expect(prompt).toContain("Alpha");
  });

  it("includes available action types", () => {
    const prompt = buildPrompt(state, "f1");
    expect(prompt).toContain("move");
    expect(prompt).toContain("attack");
    expect(prompt).toContain("recruit");
  });

  it("includes resource info", () => {
    const prompt = buildPrompt(state, "f1");
    expect(prompt).toContain("gold");
    expect(prompt).toContain("food");
  });

  it("includes JSON format instruction", () => {
    const prompt = buildPrompt(state, "f1");
    expect(prompt).toContain("JSON");
  });
});
