import { describe, it, expect } from "vitest";
import { resolveCombat } from "../combat-resolver";

describe("resolveCombat", () => {
  it("attacker wins when significantly stronger", () => {
    const result = resolveCombat(20, 5);
    expect(result.attackerWins).toBe(true);
    expect(result.remainingAttackers).toBeGreaterThan(0);
    expect(result.remainingDefenders).toBe(0);
  });

  it("defender holds when significantly stronger", () => {
    const result = resolveCombat(3, 20);
    expect(result.attackerWins).toBe(false);
    expect(result.remainingDefenders).toBeGreaterThan(0);
  });

  it("both sides take casualties", () => {
    const result = resolveCombat(10, 10);
    const totalBefore = 20;
    const totalAfter = result.remainingAttackers + result.remainingDefenders;
    expect(totalAfter).toBeLessThan(totalBefore);
  });

  it("returns 0 casualties minimum", () => {
    const result = resolveCombat(1, 1);
    expect(result.remainingAttackers).toBeGreaterThanOrEqual(0);
    expect(result.remainingDefenders).toBeGreaterThanOrEqual(0);
  });
});
