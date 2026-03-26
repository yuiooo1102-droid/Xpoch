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
    expect(prompt).toContain("march");
    expect(prompt).toContain("attack");
    expect(prompt).toContain("train");
  });

  it("includes resources in compact format", () => {
    const prompt = buildPrompt(state, "f1");
    expect(prompt).toContain("G:");
    expect(prompt).toContain("F:");
    expect(prompt).toContain("W:");
    expect(prompt).toContain("I:");
  });

  it("includes territory count", () => {
    const prompt = buildPrompt(state, "f1");
    expect(prompt).toContain("Terr:");
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

  it("includes generals info", () => {
    const prompt = buildPrompt(state, "f1");
    expect(prompt).toContain("GENERALS");
  });

  it("includes army info", () => {
    const prompt = buildPrompt(state, "f1");
    expect(prompt).toContain("ARMIES");
    expect(prompt).toContain("inf:");
    expect(prompt).toContain("cav:");
    expect(prompt).toContain("arc:");
  });

  it("includes tech info", () => {
    const prompt = buildPrompt(state, "f1");
    expect(prompt).toContain("TECH");
    expect(prompt).toContain("avail:");
  });
});
