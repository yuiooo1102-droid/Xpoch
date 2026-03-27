import { describe, it, expect } from "vitest";
import { generateMap } from "../map-generator";
import { generateThreeKingdomsMap, getPresetCities } from "../three-kingdoms-map";
import { MAP_SIZE, hexKey } from "@xpoch/shared";

describe("generateMap", () => {
  it("generates a map with correct number of tiles", () => {
    const tiles = generateMap(MAP_SIZE, 42);
    // hexDisk with radius 12: 1 + 6*(1+2+...+12) = 1 + 6*78 = 469
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

describe("generateThreeKingdomsMap", () => {
  it("returns correct tile count (469 for radius 12)", () => {
    const tiles = generateThreeKingdomsMap();
    expect(tiles.size).toBe(469);
  });

  it("is deterministic (same result each time)", () => {
    const a = generateThreeKingdomsMap();
    const b = generateThreeKingdomsMap();
    for (const [key, tileA] of a) {
      const tileB = b.get(key);
      expect(tileB).toBeDefined();
      expect(tileA.terrain).toBe(tileB!.terrain);
    }
  });

  it("洛阳 (0,0) is plains", () => {
    const tiles = generateThreeKingdomsMap();
    const luoyang = tiles.get(hexKey({ q: 0, r: 0 }));
    expect(luoyang).toBeDefined();
    expect(luoyang!.terrain).toBe("plains");
  });

  it("上庸 (-3,-1) is mountain", () => {
    const tiles = generateThreeKingdomsMap();
    const shangyong = tiles.get(hexKey({ q: -3, r: -1 }));
    expect(shangyong).toBeDefined();
    expect(shangyong!.terrain).toBe("mountain");
  });

  it("汉中 (-5,0) is mountain", () => {
    const tiles = generateThreeKingdomsMap();
    const hanzhong = tiles.get(hexKey({ q: -5, r: 0 }));
    expect(hanzhong).toBeDefined();
    expect(hanzhong!.terrain).toBe("mountain");
  });

  it("长江 river tiles are water", () => {
    const tiles = generateThreeKingdomsMap();
    // Check a non-city tile on the river
    const riverTile = tiles.get(hexKey({ q: 2, r: -3 }));
    expect(riverTile).toBeDefined();
    expect(riverTile!.terrain).toBe("water");
  });

  it("all tiles have valid terrain", () => {
    const tiles = generateThreeKingdomsMap();
    const validTerrains = new Set(["plains", "forest", "mountain", "water", "desert"]);
    for (const tile of tiles.values()) {
      expect(validTerrains.has(tile.terrain)).toBe(true);
    }
  });

  it("no tile has owner or cityId at generation", () => {
    const tiles = generateThreeKingdomsMap();
    for (const tile of tiles.values()) {
      expect(tile.owner).toBeNull();
      expect(tile.cityId).toBeNull();
    }
  });
});

describe("getPresetCities", () => {
  it("returns 25 cities total", () => {
    const cities = getPresetCities();
    expect(cities.length).toBe(25);
  });

  it("has 3 capitals (shu, wei, wu)", () => {
    const cities = getPresetCities();
    const capitals = cities.filter((c) => c.isCapital);
    expect(capitals.length).toBe(3);
    expect(capitals.map((c) => c.faction).sort()).toEqual(["shu", "wei", "wu"]);
  });

  it("capital cities have level 3", () => {
    const cities = getPresetCities();
    const capitals = cities.filter((c) => c.isCapital);
    for (const c of capitals) {
      expect(c.level).toBe(3);
    }
  });

  it("成都 is shu capital at (-6,-3)", () => {
    const cities = getPresetCities();
    const chengdu = cities.find((c) => c.name === "成都");
    expect(chengdu).toBeDefined();
    expect(chengdu!.faction).toBe("shu");
    expect(chengdu!.isCapital).toBe(true);
    expect(chengdu!.coord).toEqual({ q: -6, r: -3 });
  });

  it("邺城 is wei capital at (1,4)", () => {
    const cities = getPresetCities();
    const yecheng = cities.find((c) => c.name === "邺城");
    expect(yecheng).toBeDefined();
    expect(yecheng!.faction).toBe("wei");
    expect(yecheng!.isCapital).toBe(true);
    expect(yecheng!.coord).toEqual({ q: 1, r: 4 });
  });

  it("建业 is wu capital at (5,-3)", () => {
    const cities = getPresetCities();
    const jianye = cities.find((c) => c.name === "建业");
    expect(jianye).toBeDefined();
    expect(jianye!.faction).toBe("wu");
    expect(jianye!.isCapital).toBe(true);
    expect(jianye!.coord).toEqual({ q: 5, r: -3 });
  });

  it("all city coords are within hex radius 12", () => {
    const cities = getPresetCities();
    for (const c of cities) {
      const { q, r } = c.coord;
      const s = -q - r;
      const dist = Math.max(Math.abs(q), Math.abs(r), Math.abs(s));
      expect(dist).toBeLessThanOrEqual(12);
    }
  });
});
