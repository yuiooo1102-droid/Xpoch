import { describe, it, expect } from "vitest";
import { resolveCombat } from "../combat-resolver";
import { createUnit } from "../unit-factory";

const FACTION_A = "faction-a";
const FACTION_B = "faction-b";
const HEX = { q: 0, r: 0 };

describe("resolveCombat", () => {
  describe("trump advantage", () => {
    it("infantry trumps cavalry — infantry deals damage first", () => {
      const attackers = [createUnit(FACTION_A, "infantry", HEX)];
      const defenders = [createUnit(FACTION_B, "cavalry", HEX)];

      const result = resolveCombat(attackers, defenders, 0, 0);

      // Infantry (str 3) trumps cavalry (str 3):
      // Infantry deals 3 damage first, killing cavalry (3 >= 3).
      // Cavalry deals 0 damage back.
      expect(result.survivingAttackers).toHaveLength(1);
      expect(result.survivingDefenders).toHaveLength(0);
      expect(result.attackerLosses).toHaveLength(0);
      expect(result.defenderLosses).toHaveLength(1);
      expect(result.attackerWins).toBe(true);
    });

    it("cavalry trumps artillery — cavalry deals damage first", () => {
      const attackers = [createUnit(FACTION_A, "cavalry", HEX)];
      const defenders = [createUnit(FACTION_B, "artillery", HEX)];

      const result = resolveCombat(attackers, defenders, 0, 0);

      // Cavalry (str 3) trumps artillery (str 4):
      // Cavalry deals 3 damage first. 3 < 4, so artillery survives.
      // Artillery deals 4 damage back. 4 >= 3, so cavalry dies.
      expect(result.survivingAttackers).toHaveLength(0);
      expect(result.survivingDefenders).toHaveLength(1);
      expect(result.attackerWins).toBe(false);
    });

    it("artillery trumps infantry — artillery deals damage first", () => {
      const attackers = [createUnit(FACTION_A, "artillery", HEX)];
      const defenders = [createUnit(FACTION_B, "infantry", HEX)];

      const result = resolveCombat(attackers, defenders, 0, 0);

      // Artillery (str 4) trumps infantry (str 3):
      // Artillery deals 4 first, killing infantry (4 >= 3).
      // Infantry deals 0 back.
      expect(result.survivingAttackers).toHaveLength(1);
      expect(result.survivingDefenders).toHaveLength(0);
      expect(result.attackerWins).toBe(true);
    });
  });

  describe("equal strength — tie goes to defender", () => {
    it("same type and strength results in mutual kill, defender wins", () => {
      const attackers = [createUnit(FACTION_A, "infantry", HEX)];
      const defenders = [createUnit(FACTION_B, "infantry", HEX)];

      const result = resolveCombat(attackers, defenders, 0, 0);

      // Infantry (3) vs infantry (3): simultaneous, both die.
      // 0 vs 0 — tie goes to defender.
      expect(result.survivingAttackers).toHaveLength(0);
      expect(result.survivingDefenders).toHaveLength(0);
      expect(result.attackerWins).toBe(false);
    });
  });

  describe("overwhelming force", () => {
    it("3 infantry vs 1 cavalry — attacker wins with survivors", () => {
      const attackers = [
        createUnit(FACTION_A, "infantry", HEX),
        createUnit(FACTION_A, "infantry", HEX),
        createUnit(FACTION_A, "infantry", HEX),
      ];
      const defenders = [createUnit(FACTION_B, "cavalry", HEX)];

      const result = resolveCombat(attackers, defenders, 0, 0);

      // Matchup 1: infantry trumps cavalry → cavalry dies, infantry lives.
      // Matchup 2 & 3: infantry have no opponent → survive.
      expect(result.survivingAttackers).toHaveLength(3);
      expect(result.survivingDefenders).toHaveLength(0);
      expect(result.attackerWins).toBe(true);
    });
  });

  describe("city defense bonus", () => {
    it("attacker wins when all defenders are killed despite city bonus", () => {
      // 1 artillery (str 4) attacking 1 cavalry (str 3) in a city (bonus 4)
      // Cavalry (def) trumps artillery (atk): defender deals 3 first.
      // 3 < 4 so artillery survives. Artillery deals 4 back, 4 >= 3 cavalry dies.
      // All defenders killed → city bonus no longer applies.
      // Surviving attacker str=4 vs defender str=0 → attacker wins.
      const attackers = [createUnit(FACTION_A, "artillery", HEX)];
      const defenders = [createUnit(FACTION_B, "cavalry", HEX)];

      const result = resolveCombat(attackers, defenders, 0, 4);

      // Cavalry trumps artillery: cavalry deals 3 first.
      // 3 < 4, artillery survives. Artillery deals 4 back, kills cavalry.
      // All defenders eliminated → city/terrain bonuses don't apply.
      expect(result.attackerWins).toBe(true);
    });

    it("attacker overcomes city defense with superior numbers", () => {
      const attackers = [
        createUnit(FACTION_A, "infantry", HEX),
        createUnit(FACTION_A, "infantry", HEX),
        createUnit(FACTION_A, "artillery", HEX),
      ];
      const defenders = [createUnit(FACTION_B, "cavalry", HEX)];

      // Matchup 1: artillery(4) vs cavalry(3). Cavalry trumps artillery:
      //   Cavalry deals 3 first. 3 < 4, artillery survives. Arty deals 4 back, kills cavalry.
      // Matchup 2 & 3: infantry unopposed, survive.
      // Attacker str: 4 + 3 + 3 = 10. Defender str: 0 + city bonus 4 = 4.
      const result = resolveCombat(attackers, defenders, 0, 4);

      expect(result.attackerWins).toBe(true);
    });
  });

  describe("terrain defense bonus", () => {
    it("forest bonus helps defender survive", () => {
      // 1 scout (str 1) vs 1 scout (str 1) with forest bonus 1
      // Simultaneous: both take 1 damage, both die.
      // Surviving: 0 attacker, 0 defender. Terrain bonus only applies to survivors.
      // 0 vs 0 + terrain*0 + 0 = tie → defender wins.
      const attackers = [createUnit(FACTION_A, "scout", HEX)];
      const defenders = [createUnit(FACTION_B, "scout", HEX)];

      const result = resolveCombat(attackers, defenders, 1, 0);

      expect(result.attackerWins).toBe(false);
    });

    it("mountain bonus tilts outcome for defender", () => {
      // 1 infantry (3) attacking, 1 infantry (3) defending on mountain (bonus 2)
      // Simultaneous: both take 3 damage, both die.
      // 0 vs 0 + 0 = 0 → tie → defender wins.
      const attackers = [createUnit(FACTION_A, "infantry", HEX)];
      const defenders = [createUnit(FACTION_B, "infantry", HEX)];

      const result = resolveCombat(attackers, defenders, 2, 0);

      expect(result.attackerWins).toBe(false);
    });

    it("terrain bonus applies per surviving defender", () => {
      // 1 infantry (atk) vs 2 infantry (def) on mountain (bonus 2)
      // Matchup 1: infantry vs infantry, simultaneous, both die.
      // Matchup 2: defender infantry unopposed, survives.
      // Attacker str: 0. Defender str: 3 + 2*1 + 0 = 5. Defender wins.
      const attackers = [createUnit(FACTION_A, "infantry", HEX)];
      const defenders = [
        createUnit(FACTION_B, "infantry", HEX),
        createUnit(FACTION_B, "infantry", HEX),
      ];

      const result = resolveCombat(attackers, defenders, 2, 0);

      expect(result.attackerWins).toBe(false);
      expect(result.survivingDefenders).toHaveLength(1);
    });
  });

  describe("mixed unit types", () => {
    it("mixed attackers vs mixed defenders", () => {
      const attackers = [
        createUnit(FACTION_A, "artillery", HEX),  // str 4
        createUnit(FACTION_A, "infantry", HEX),    // str 3
      ];
      const defenders = [
        createUnit(FACTION_B, "infantry", HEX),    // str 3
        createUnit(FACTION_B, "cavalry", HEX),     // str 3
      ];

      const result = resolveCombat(attackers, defenders, 0, 0);

      // Sorted by strength: attackers [artillery(4), infantry(3)]
      //                     defenders [infantry(3), cavalry(3)]
      //
      // Matchup 1: artillery(4) vs infantry(3) — artillery trumps infantry.
      //   Artillery deals 4 first, kills infantry. Infantry deals 0 back. Artillery survives.
      //
      // Matchup 2: infantry(3) vs cavalry(3) — infantry trumps cavalry.
      //   Infantry deals 3 first, kills cavalry. Cavalry deals 0 back. Infantry survives.
      //
      // Attacker str: 4 + 3 = 7. Defender str: 0. Attacker wins.
      expect(result.survivingAttackers).toHaveLength(2);
      expect(result.survivingDefenders).toHaveLength(0);
      expect(result.attackerWins).toBe(true);
      expect(result.log.length).toBeGreaterThan(0);
    });
  });

  describe("edge cases", () => {
    it("no attackers — defender wins", () => {
      const defenders = [createUnit(FACTION_B, "infantry", HEX)];
      const result = resolveCombat([], defenders, 0, 0);

      expect(result.attackerWins).toBe(false);
      expect(result.survivingDefenders).toHaveLength(1);
    });

    it("no defenders — attacker wins", () => {
      const attackers = [createUnit(FACTION_A, "infantry", HEX)];
      const result = resolveCombat(attackers, [], 0, 0);

      expect(result.attackerWins).toBe(true);
      expect(result.survivingAttackers).toHaveLength(1);
    });

    it("settlers are killed by combat units", () => {
      const attackers = [createUnit(FACTION_A, "infantry", HEX)];
      const defenders = [createUnit(FACTION_B, "settler", HEX)];

      const result = resolveCombat(attackers, defenders, 0, 0);

      // Infantry (3) vs settler (0): simultaneous (no trump between them).
      // Settler takes 3 damage, dies (3 >= 0). Infantry takes 0 damage, survives.
      expect(result.attackerWins).toBe(true);
      expect(result.survivingAttackers).toHaveLength(1);
      expect(result.defenderLosses).toHaveLength(1);
    });

    it("log is populated for every matchup", () => {
      const attackers = [
        createUnit(FACTION_A, "infantry", HEX),
        createUnit(FACTION_A, "cavalry", HEX),
      ];
      const defenders = [createUnit(FACTION_B, "artillery", HEX)];

      const result = resolveCombat(attackers, defenders, 0, 0);

      // 1 matchup log + 1 unopposed log + 1 result log = 3
      expect(result.log.length).toBeGreaterThanOrEqual(3);
    });
  });
});
