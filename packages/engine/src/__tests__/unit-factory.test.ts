import { describe, it, expect } from "vitest";
import { createUnit, generateUnitId } from "../unit-factory";
import { UNIT_STATS } from "@xpoch/shared";
import type { UnitType } from "@xpoch/shared";

const FACTION = "faction-test";
const HEX = { q: 3, r: 5 };

describe("createUnit", () => {
  describe("base unit stats", () => {
    const unitTypes: UnitType[] = ["infantry", "cavalry", "artillery", "settler", "scout"];

    unitTypes.forEach((type) => {
      it(`creates ${type} with correct base stats`, () => {
        const unit = createUnit(FACTION, type, HEX);
        const expected = UNIT_STATS[type];

        expect(unit.type).toBe(type);
        expect(unit.factionId).toBe(FACTION);
        expect(unit.coord).toEqual(HEX);
        expect(unit.strength).toBe(expected.strength);
        expect(unit.maxStrength).toBe(expected.strength);
        expect(unit.movement).toBe(expected.movement);
        expect(unit.maxMovement).toBe(expected.movement);
        expect(unit.upgraded).toBe(false);
      });
    });
  });

  describe("upgraded units", () => {
    it("upgraded infantry has strength 5 (Iron Working)", () => {
      const unit = createUnit(FACTION, "infantry", HEX, true);

      expect(unit.strength).toBe(5);
      expect(unit.maxStrength).toBe(5);
      expect(unit.movement).toBe(1);
      expect(unit.upgraded).toBe(true);
    });

    it("upgraded cavalry has strength 5 and movement 3 (Horseback Riding)", () => {
      const unit = createUnit(FACTION, "cavalry", HEX, true);

      expect(unit.strength).toBe(5);
      expect(unit.maxStrength).toBe(5);
      expect(unit.movement).toBe(3);
      expect(unit.maxMovement).toBe(3);
      expect(unit.upgraded).toBe(true);
    });

    it("upgraded artillery has strength 6 (Gunpowder)", () => {
      const unit = createUnit(FACTION, "artillery", HEX, true);

      expect(unit.strength).toBe(6);
      expect(unit.maxStrength).toBe(6);
      expect(unit.movement).toBe(1);
      expect(unit.upgraded).toBe(true);
    });

    it("upgraded settler has no stat change", () => {
      const unit = createUnit(FACTION, "settler", HEX, true);

      expect(unit.strength).toBe(UNIT_STATS.settler.strength);
      expect(unit.movement).toBe(UNIT_STATS.settler.movement);
      expect(unit.upgraded).toBe(true);
    });

    it("upgraded scout has no stat change", () => {
      const unit = createUnit(FACTION, "scout", HEX, true);

      expect(unit.strength).toBe(UNIT_STATS.scout.strength);
      expect(unit.movement).toBe(UNIT_STATS.scout.movement);
      expect(unit.upgraded).toBe(true);
    });
  });

  it("creates immutable coord (does not share reference)", () => {
    const mutableCoord = { q: 1, r: 2 };
    const unit = createUnit(FACTION, "infantry", mutableCoord);

    expect(unit.coord).toEqual({ q: 1, r: 2 });
    expect(unit.coord).not.toBe(mutableCoord);
  });
});

describe("generateUnitId", () => {
  it("returns unique IDs on successive calls", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(generateUnitId());
    }
    expect(ids.size).toBe(100);
  });

  it("returns a string starting with u_", () => {
    const id = generateUnitId();
    expect(id).toMatch(/^u_/);
  });
});
