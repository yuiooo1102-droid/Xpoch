import { describe, it, expect } from "vitest";
import { generateMap } from "../map-generator";
import { MAP_SIZE } from "@xpoch/shared";

describe("generateMap", () => {
  it("generates a map with correct number of tiles", () => {
    const tiles = generateMap(MAP_SIZE, 42);
    expect(tiles.size).toBe(331);
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
});
