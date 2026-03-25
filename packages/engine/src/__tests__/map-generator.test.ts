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

  it("every tile has building: null, cityId: null, isCityOutskirt: null", () => {
    const tiles = generateMap(MAP_SIZE, 42);
    for (const tile of tiles.values()) {
      expect(tile.building).toBeNull();
      expect(tile.cityId).toBeNull();
      expect(tile.isCityOutskirt).toBeNull();
    }
  });

  it("natural resources are only on valid terrains", () => {
    const tiles = generateMap(MAP_SIZE, 42);
    const validResourceTerrains: Record<string, string[]> = {
      iron: ["mountain", "forest"],
      horses: ["plains"],
      saltpeter: ["desert", "plains"],
      oil: ["desert", "mountain"],
    };
    for (const tile of tiles.values()) {
      if (tile.naturalResource !== null) {
        const allowed = validResourceTerrains[tile.naturalResource];
        expect(allowed).toBeDefined();
        expect(allowed).toContain(tile.terrain);
      }
    }
  });

  it("some land tiles have natural resources (~15%)", () => {
    const tiles = generateMap(MAP_SIZE, 42);
    const landTiles = [...tiles.values()].filter((t) => t.terrain !== "water");
    const resourceTiles = landTiles.filter((t) => t.naturalResource !== null);
    // Expect roughly 5-25% (with some tolerance for randomness)
    const ratio = resourceTiles.length / landTiles.length;
    expect(ratio).toBeGreaterThan(0.03);
    expect(ratio).toBeLessThan(0.35);
  });

  it("water tiles never have natural resources", () => {
    const tiles = generateMap(MAP_SIZE, 42);
    for (const tile of tiles.values()) {
      if (tile.terrain === "water") {
        expect(tile.naturalResource).toBeNull();
      }
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
