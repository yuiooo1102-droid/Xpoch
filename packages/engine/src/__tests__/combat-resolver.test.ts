import { describe, it, expect } from "vitest";
import {
  resolveBattle,
  totalTroops,
  calculatePower,
} from "../combat-resolver";
import type { Troops, GeneralDef } from "@xpoch/shared";

const ZERO_TROOPS: Troops = { infantry: 0, cavalry: 0, archer: 0 };

const makeGeneral = (
  overrides: Partial<GeneralDef> = {},
): GeneralDef => ({
  id: "test-general",
  name: "Test General",
  specialty: "all",
  baseAttack: 0,
  baseDefense: 0,
  baseSpeed: 2,
  skill: { name: "none", type: "passive", description: "none" },
  ...overrides,
});

describe("totalTroops", () => {
  it("sums all troop types", () => {
    expect(totalTroops({ infantry: 100, cavalry: 50, archer: 75 })).toBe(225);
  });

  it("returns 0 for empty troops", () => {
    expect(totalTroops(ZERO_TROOPS)).toBe(0);
  });
});

describe("calculatePower", () => {
  it("calculates base power without general", () => {
    const troops: Troops = { infantry: 100, cavalry: 0, archer: 0 };
    const enemy: Troops = { infantry: 100, cavalry: 0, archer: 0 };
    const power = calculatePower(troops, null, enemy);
    // 100 * 3 (infantry attack) * 1.0 (no general) = 300
    // No trump target (enemy is infantry, infantry trumps cavalry not infantry)
    expect(power).toBeCloseTo(300, 0);
  });

  it("applies general attack bonus", () => {
    const troops: Troops = { infantry: 100, cavalry: 0, archer: 0 };
    const enemy: Troops = { infantry: 100, cavalry: 0, archer: 0 };
    const general = makeGeneral({ baseAttack: 50 }); // 50% bonus
    const power = calculatePower(troops, general, enemy);
    // 100 * 3 * 1.5 = 450
    expect(power).toBeCloseTo(450, 0);
  });

  it("applies trump bonus when attacking trumped troop type", () => {
    // Infantry trumps cavalry
    const troops: Troops = { infantry: 100, cavalry: 0, archer: 0 };
    const enemy: Troops = { infantry: 0, cavalry: 100, archer: 0 };
    const power = calculatePower(troops, null, enemy);
    // 100 * 3 * 1.3 (all enemy is cavalry, trumped by infantry)
    expect(power).toBeCloseTo(390, 0);
  });

  it("applies partial trump bonus for mixed enemy", () => {
    const troops: Troops = { infantry: 100, cavalry: 0, archer: 0 };
    // 50% cavalry (trumped), 50% infantry (not trumped)
    const enemy: Troops = { infantry: 50, cavalry: 50, archer: 0 };
    const power = calculatePower(troops, null, enemy);
    // 100 * 3 * (0.5 * 1.0 + 0.5 * 1.3) = 300 * 1.15 = 345
    expect(power).toBeCloseTo(345, 0);
  });
});

describe("resolveBattle", () => {
  describe("trump advantage", () => {
    it("infantry vs cavalry — infantry has 1.3x trump advantage", () => {
      const attacker = {
        troops: { infantry: 200, cavalry: 0, archer: 0 } as Troops,
        general: null,
      };
      const defender = {
        troops: { infantry: 0, cavalry: 200, archer: 0 } as Troops,
        general: null,
      };

      const result = resolveBattle(attacker, defender, 0, 0);

      // Infantry trumps cavalry: attacker has advantage
      expect(result.attackerRemaining.infantry).toBeGreaterThan(
        result.defenderRemaining.cavalry,
      );
      expect(result.attackerWins).toBe(true);
    });

    it("cavalry vs archer — cavalry has trump advantage", () => {
      const attacker = {
        troops: { infantry: 0, cavalry: 200, archer: 0 } as Troops,
        general: null,
      };
      const defender = {
        troops: { infantry: 0, cavalry: 0, archer: 200 } as Troops,
        general: null,
      };

      const result = resolveBattle(attacker, defender, 0, 0);
      expect(result.attackerWins).toBe(true);
    });

    it("archer vs infantry — archer has trump advantage", () => {
      const attacker = {
        troops: { infantry: 0, cavalry: 0, archer: 200 } as Troops,
        general: null,
      };
      const defender = {
        troops: { infantry: 200, cavalry: 0, archer: 0 } as Troops,
        general: null,
      };

      const result = resolveBattle(attacker, defender, 0, 0);
      expect(result.attackerWins).toBe(true);
    });
  });

  describe("general bonuses", () => {
    it("high-attack general increases troop power", () => {
      const troops: Troops = { infantry: 200, cavalry: 0, archer: 0 };
      const strongGeneral = makeGeneral({ baseAttack: 80 });

      const resultWithGeneral = resolveBattle(
        { troops, general: strongGeneral },
        { troops, general: null },
        0,
        0,
      );

      expect(resultWithGeneral.attackerWins).toBe(true);
      expect(totalTroops(resultWithGeneral.attackerRemaining)).toBeGreaterThan(
        totalTroops(resultWithGeneral.defenderRemaining),
      );
    });

    it("high-defense general reduces troop losses", () => {
      const troops: Troops = { infantry: 200, cavalry: 0, archer: 0 };
      const defGeneral = makeGeneral({ baseDefense: 80 });

      const resultWithDefense = resolveBattle(
        { troops, general: null },
        { troops, general: defGeneral },
        0,
        0,
      );

      expect(resultWithDefense.attackerWins).toBe(false);
    });
  });

  describe("city defense", () => {
    it("city defense helps defender survive", () => {
      const troops: Troops = { infantry: 200, cavalry: 0, archer: 0 };

      const withoutCity = resolveBattle(
        { troops, general: null },
        { troops, general: null },
        0,
        0,
      );
      const withCity = resolveBattle(
        { troops, general: null },
        { troops, general: null },
        0,
        10,
      );

      expect(totalTroops(withCity.defenderLosses)).toBeLessThanOrEqual(
        totalTroops(withoutCity.defenderLosses),
      );
    });

    it("terrain defense helps defender", () => {
      const troops: Troops = { infantry: 200, cavalry: 0, archer: 0 };

      const withoutTerrain = resolveBattle(
        { troops, general: null },
        { troops, general: null },
        0,
        0,
      );
      const withTerrain = resolveBattle(
        { troops, general: null },
        { troops, general: null },
        5,
        0,
      );

      expect(totalTroops(withTerrain.defenderLosses)).toBeLessThanOrEqual(
        totalTroops(withoutTerrain.defenderLosses),
      );
    });
  });

  describe("balanced armies", () => {
    it("equal armies with no bonuses — defender wins (attacker has no advantage)", () => {
      const troops: Troops = { infantry: 100, cavalry: 100, archer: 100 };

      const result = resolveBattle(
        { troops, general: null },
        { troops, general: null },
        0,
        0,
      );

      expect(result.attackerWins).toBe(false);
    });

    it("minimum 10% losses on both sides", () => {
      const attacker = {
        troops: { infantry: 100, cavalry: 0, archer: 0 } as Troops,
        general: null,
      };
      const defender = {
        troops: { infantry: 100, cavalry: 0, archer: 0 } as Troops,
        general: makeGeneral({ baseDefense: 99 }),
      };

      const result = resolveBattle(attacker, defender, 0, 0);

      expect(result.defenderLosses.infantry).toBeGreaterThanOrEqual(10);
      expect(result.attackerLosses.infantry).toBeGreaterThanOrEqual(10);
    });
  });

  describe("garrison", () => {
    it("garrison troops add to defender strength", () => {
      const atkTroops: Troops = { infantry: 200, cavalry: 0, archer: 0 };
      const defTroops: Troops = { infantry: 100, cavalry: 0, archer: 0 };
      const garrison: Troops = { infantry: 100, cavalry: 0, archer: 0 };

      const withoutGarrison = resolveBattle(
        { troops: atkTroops, general: null },
        { troops: defTroops, general: null },
        0,
        0,
      );
      const withGarrison = resolveBattle(
        { troops: atkTroops, general: null },
        { troops: defTroops, general: null, garrison },
        0,
        0,
      );

      expect(totalTroops(withGarrison.defenderRemaining)).toBeGreaterThan(
        totalTroops(withoutGarrison.defenderRemaining),
      );
    });
  });

  describe("edge cases", () => {
    it("no attackers — defender wins", () => {
      const result = resolveBattle(
        { troops: ZERO_TROOPS, general: null },
        { troops: { infantry: 100, cavalry: 0, archer: 0 }, general: null },
        0,
        0,
      );
      expect(result.attackerWins).toBe(false);
      expect(totalTroops(result.defenderRemaining)).toBe(100);
    });

    it("no defenders — attacker wins", () => {
      const result = resolveBattle(
        { troops: { infantry: 100, cavalry: 0, archer: 0 }, general: null },
        { troops: ZERO_TROOPS, general: null },
        0,
        0,
      );
      expect(result.attackerWins).toBe(true);
      expect(totalTroops(result.attackerRemaining)).toBe(100);
    });

    it("log is populated", () => {
      const result = resolveBattle(
        { troops: { infantry: 100, cavalry: 0, archer: 0 }, general: null },
        { troops: { infantry: 100, cavalry: 0, archer: 0 }, general: null },
        0,
        0,
      );
      expect(result.log.length).toBeGreaterThan(0);
    });

    it("exp gained equals total losses of losing side", () => {
      const result = resolveBattle(
        { troops: { infantry: 300, cavalry: 0, archer: 0 }, general: null },
        { troops: { infantry: 100, cavalry: 0, archer: 0 }, general: null },
        0,
        0,
      );
      expect(result.attackerWins).toBe(true);
      expect(result.expGained).toBe(totalTroops(result.defenderLosses));
    });
  });
});
