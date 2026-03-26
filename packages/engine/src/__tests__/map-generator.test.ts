import { describe, it, expect } from "vitest";
import { generateMap } from "../map-generator";
import { MAP_SIZE } from "@xpoch/shared";

describe("generateMap", () => {
  it("generates a map with correct number of tiles", () => {
    const tiles = generateMap(MAP_SIZE, 42);
    // hexDisk with radius 12: 1 + 6*(1+2+...+12) = 1 + 6*78 = 469
    // Actually: sum of hexRing(0..12) = 1 + 6 + 12 + 18 + ... + 72
    // = 1 + 6*(1+2+...+12) = 1 + 6*78 = 469
    expect(tiles.size).toBe(469);
  });

  it("every tile has valid terrain", () => {
    const tiles = generateMap(MAP_SIZE, 42);
    const validTerrains = new Set(["plains", "forest", "mountain", "water", "desert"]);
    for (const tile of tiles.values()) {
      expect(validTerrains.has(tile.terrain)).toBe(true);
    }
  });

  it("no tile has an owner at generation", () => {
    const tiles = generateMap(MAP_SIZE, 42);
    for (const tile of tiles.values()) {
      expect(tile.owner).toBeNull();
    }
  });

  it("every tile has building: null and cityId: null", () => {
    const tiles = generateMap(MAP_SIZE, 42);
    for (const tile of tiles.values()) {
      expect(tile.building).toBeNull();
      expect(tile.cityId).toBeNull();
    }
  });

  it("tiles have correct coord structure", () => {
    const tiles = generateMap(5, 42);
    for (const tile of tiles.values()) {
      expect(tile.coord).toBeDefined();
      expect(typeof tile.coord.q).toBe("number");
      expect(typeof tile.coord.r).toBe("number");
    }
  });

  it("is deterministic with same seed", () => {
    const a = generateMap(MAP_SIZE, 123);
    const b = generateMap(MAP_SIZE, 123);
    expect([...a.entries()]).toEqual([...b.entries()]);
  });

  it("is different with different seeds", () => {
    const a = generateMap(MAP_SIZE, 1);
    const b = generateMap(MAP_SIZE, 2);
    const aTerrain = [...a.values()].map((t) => t.terrain).join("");
    const bTerrain = [...b.values()].map((t) => t.terrain).join("");
    expect(aTerrain).not.toBe(bTerrain);
  });

  it("generates correct tile count for small radius", () => {
    const tiles = generateMap(2, 42);
    // radius 2: 1 + 6 + 12 = 19
    expect(tiles.size).toBe(19);
  });
});
