import { describe, it, expect } from "vitest";
import { buildPrompt } from "../prompt-builder";
import { createInitialState } from "@xpoch/engine";

describe("buildPrompt", () => {
  const state = createInitialState(5, 42, [
    { id: "f1", name: "Alpha", modelProvider: "mock", color: "#f00", historicalFaction: "shu" as const },
    { id: "f2", name: "Beta", modelProvider: "mock", color: "#0f0", historicalFaction: "wei" as const },
  ]);

  it("includes game rules", () => {
    const prompt = buildPrompt(state, "f1");
    expect(prompt).toContain("RULES");
    expect(prompt).toContain("VICTORY");
    expect(prompt).toContain("COMBAT");
  });

  it("includes faction status", () => {
    const prompt = buildPrompt(state, "f1");
    expect(prompt).toContain("Alpha");
    expect(prompt).toContain("金:");
    expect(prompt).toContain("粮:");
    expect(prompt).toContain("领地:");
  });

  it("includes generals", () => {
    const prompt = buildPrompt(state, "f1");
    expect(prompt).toContain("GENERALS");
    expect(prompt).toContain("技:");
  });

  it("includes armies with troop breakdown", () => {
    const prompt = buildPrompt(state, "f1");
    expect(prompt).toContain("ARMIES");
    expect(prompt).toContain("步");
    expect(prompt).toContain("骑");
  });

  it("includes cities", () => {
    const prompt = buildPrompt(state, "f1");
    expect(prompt).toContain("CITIES");
    expect(prompt).toContain("驻军");
  });

  it("includes tech", () => {
    const prompt = buildPrompt(state, "f1");
    expect(prompt).toContain("TECH");
    expect(prompt).toContain("可研究");
  });

  it("includes enemies", () => {
    const prompt = buildPrompt(state, "f1");
    expect(prompt).toContain("ENEMIES");
  });

  it("includes JSON response format", () => {
    const prompt = buildPrompt(state, "f1");
    expect(prompt).toContain("JSON");
    expect(prompt).toContain("march");
    expect(prompt).toContain("attack");
    expect(prompt).toContain("train");
  });
});
