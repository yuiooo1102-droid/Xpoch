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
    expect(prompt).toContain("fortify");
    expect(prompt).toContain("train");
    expect(prompt).toContain("build");
  });

  it("includes gold and food resource info", () => {
    const prompt = buildPrompt(state, "f1");
    expect(prompt).toContain("Gold:");
    expect(prompt).toContain("Food:");
  });

  it("includes research info", () => {
    const prompt = buildPrompt(state, "f1");
    expect(prompt).toContain("Research:");
  });

  it("includes JSON format instruction", () => {
    const prompt = buildPrompt(state, "f1");
    expect(prompt).toContain("JSON");
  });

  it("includes city info", () => {
    const prompt = buildPrompt(state, "f1");
    expect(prompt).toContain("Your Cities");
    expect(prompt).toContain("Alpha Capital");
  });

  it("includes unit info", () => {
    const prompt = buildPrompt(state, "f1");
    expect(prompt).toContain("Your Units");
    expect(prompt).toContain("infantry");
    expect(prompt).toContain("scout");
  });

  it("includes tech info", () => {
    const prompt = buildPrompt(state, "f1");
    expect(prompt).toContain("Your Technologies");
    expect(prompt).toContain("Available to research");
  });
});
