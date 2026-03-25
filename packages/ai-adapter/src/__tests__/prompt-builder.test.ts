import { describe, it, expect } from "vitest";
import { buildPrompt } from "../prompt-builder";
import { createInitialState } from "@xpoch/engine";

describe("buildPrompt", () => {
  const state = createInitialState(5, 42, [
    { id: "f1", name: "Alpha", modelProvider: "mock", color: "#f00" },
    { id: "f2", name: "Beta", modelProvider: "mock", color: "#0f0" },
  ]);

  it("includes faction name", () => {
    const prompt = buildPrompt(state, "f1");
    expect(prompt).toContain("Alpha");
  });

  it("includes action types", () => {
    const prompt = buildPrompt(state, "f1");
    expect(prompt).toContain("move");
    expect(prompt).toContain("attack");
    expect(prompt).toContain("train");
    expect(prompt).toContain("build");
  });

  it("includes gold and food in compact format", () => {
    const prompt = buildPrompt(state, "f1");
    expect(prompt).toContain("G:");
    expect(prompt).toContain("F:");
  });

  it("includes research info in compact format", () => {
    const prompt = buildPrompt(state, "f1");
    expect(prompt).toContain("R:");
  });

  it("includes JSON format instruction", () => {
    const prompt = buildPrompt(state, "f1");
    expect(prompt).toContain("JSON");
  });

  it("includes city info", () => {
    const prompt = buildPrompt(state, "f1");
    expect(prompt).toContain("CITIES");
    expect(prompt).toContain("Alpha Capital");
  });

  it("includes unit info with short IDs", () => {
    const prompt = buildPrompt(state, "f1");
    expect(prompt).toContain("UNITS");
    expect(prompt).toContain("infantry");
    expect(prompt).toContain("scout");
    expect(prompt).toContain("u0");
  });

  it("includes tech info", () => {
    const prompt = buildPrompt(state, "f1");
    expect(prompt).toContain("TECH");
    expect(prompt).toContain("avail:");
  });
});
