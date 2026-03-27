import type { HexCoord, Tile, TerrainType, HistoricalFaction } from "@xpoch/shared";
import { hexDisk, hexKey } from "@xpoch/shared";
import { MAP_SIZE } from "@xpoch/shared";

// === City Preset Definition ===

export interface CityPreset {
  readonly id: string;
  readonly name: string;
  readonly coord: HexCoord;
  readonly faction: HistoricalFaction;
  readonly isCapital: boolean;
  readonly level: number;
  readonly garrison: { readonly infantry: number; readonly cavalry: number; readonly archer: number };
}

// === Preset Cities (from Three Kingdoms design doc) ===

const LARGE_GARRISON = { infantry: 500, cavalry: 200, archer: 200 } as const;
const MEDIUM_GARRISON = { infantry: 300, cavalry: 100, archer: 100 } as const;

const PRESET_CITIES: readonly CityPreset[] = [
  // Large cities (level 3)
  { id: "luoyang",    name: "洛阳", coord: { q: 0, r: 0 },    faction: "neutral", isCapital: false, level: 3, garrison: LARGE_GARRISON },
  { id: "changan",    name: "长安", coord: { q: -4, r: 1 },   faction: "neutral", isCapital: false, level: 3, garrison: LARGE_GARRISON },
  { id: "yecheng",    name: "邺城", coord: { q: 1, r: 4 },    faction: "wei",     isCapital: true,  level: 3, garrison: LARGE_GARRISON },
  { id: "xuchang",    name: "许昌", coord: { q: 1, r: 1 },    faction: "wei",     isCapital: false, level: 3, garrison: LARGE_GARRISON },
  { id: "chengdu",    name: "成都", coord: { q: -6, r: -3 },  faction: "shu",     isCapital: true,  level: 3, garrison: LARGE_GARRISON },
  { id: "jianye",     name: "建业", coord: { q: 5, r: -3 },   faction: "wu",      isCapital: true,  level: 3, garrison: LARGE_GARRISON },
  { id: "wuchang",    name: "武昌", coord: { q: 3, r: -4 },   faction: "wu",      isCapital: false, level: 3, garrison: LARGE_GARRISON },

  // Medium cities (level 2)
  { id: "xiangyang",  name: "襄阳", coord: { q: -1, r: -1 },  faction: "neutral", isCapital: false, level: 2, garrison: MEDIUM_GARRISON },
  { id: "jiangling",  name: "江陵", coord: { q: -1, r: -3 },  faction: "neutral", isCapital: false, level: 2, garrison: MEDIUM_GARRISON },
  { id: "xinye",      name: "新野", coord: { q: -1, r: 0 },   faction: "neutral", isCapital: false, level: 2, garrison: MEDIUM_GARRISON },
  { id: "shangyong",  name: "上庸", coord: { q: -3, r: -1 },  faction: "neutral", isCapital: false, level: 2, garrison: MEDIUM_GARRISON },
  { id: "hanzhong",   name: "汉中", coord: { q: -5, r: 0 },   faction: "neutral", isCapital: false, level: 2, garrison: MEDIUM_GARRISON },
  { id: "wancheng",   name: "宛城", coord: { q: -1, r: 2 },   faction: "neutral", isCapital: false, level: 2, garrison: MEDIUM_GARRISON },
  { id: "lujiang",    name: "庐江", coord: { q: 4, r: -2 },   faction: "neutral", isCapital: false, level: 2, garrison: MEDIUM_GARRISON },
  { id: "chaisang",   name: "柴桑", coord: { q: 3, r: -3 },   faction: "neutral", isCapital: false, level: 2, garrison: MEDIUM_GARRISON },
  { id: "hefei",      name: "合肥", coord: { q: 3, r: 0 },    faction: "neutral", isCapital: false, level: 2, garrison: MEDIUM_GARRISON },
  { id: "changsha",   name: "长沙", coord: { q: 0, r: -4 },   faction: "neutral", isCapital: false, level: 2, garrison: MEDIUM_GARRISON },
  { id: "guiyang",    name: "桂阳", coord: { q: 0, r: -5 },   faction: "neutral", isCapital: false, level: 2, garrison: MEDIUM_GARRISON },
  { id: "xuzhou",     name: "徐州", coord: { q: 4, r: 2 },    faction: "neutral", isCapital: false, level: 2, garrison: MEDIUM_GARRISON },
  { id: "puyang",     name: "濮阳", coord: { q: 1, r: 3 },    faction: "neutral", isCapital: false, level: 2, garrison: MEDIUM_GARRISON },
  { id: "nanjun",     name: "南郡", coord: { q: -2, r: -2 },  faction: "neutral", isCapital: false, level: 2, garrison: MEDIUM_GARRISON },
  { id: "mianzhu",    name: "绵竹", coord: { q: -6, r: -2 },  faction: "shu",     isCapital: false, level: 2, garrison: MEDIUM_GARRISON },
  { id: "jiange",     name: "剑阁", coord: { q: -6, r: -1 },  faction: "shu",     isCapital: false, level: 2, garrison: MEDIUM_GARRISON },
  { id: "nanzhong",   name: "南中", coord: { q: -5, r: -5 },  faction: "neutral", isCapital: false, level: 2, garrison: MEDIUM_GARRISON },
  { id: "kuaiji",     name: "会稽", coord: { q: 6, r: -5 },   faction: "wu",      isCapital: false, level: 2, garrison: MEDIUM_GARRISON },
];

/**
 * Get all preset cities (immutable).
 */
export function getPresetCities(): readonly CityPreset[] {
  return PRESET_CITIES;
}

// === Terrain lookup for city tiles (override terrain at city locations) ===

const CITY_TERRAIN_OVERRIDE: ReadonlyMap<string, TerrainType> = new Map([
  // Mountain cities
  [hexKey({ q: -3, r: -1 }), "mountain"],  // 上庸
  [hexKey({ q: -5, r: 0 }), "mountain"],   // 汉中
  [hexKey({ q: -6, r: -1 }), "mountain"],  // 剑阁
  // Forest cities
  [hexKey({ q: -6, r: -2 }), "forest"],    // 绵竹
  [hexKey({ q: 0, r: -5 }), "forest"],     // 桂阳
  [hexKey({ q: -5, r: -5 }), "forest"],    // 南中
]);

// === Yangtze River (长江) tiles ===

function isYangtzeRiver(q: number, r: number): boolean {
  // Band of water from west to east at roughly r=-3 to r=-2
  // Main course: (-2,-3) through (0,-3) to (5,-3)
  if (r === -3 && q >= -2 && q <= 5) {
    // Skip city locations on the river
    const key = hexKey({ q, r });
    const hasCityHere = PRESET_CITIES.some(
      (c) => c.coord.q === q && c.coord.r === r,
    );
    return !hasCityHere;
  }
  // River bend near (-2,-2) — skip if city there
  if (q === -2 && r === -2) return false; // 南郡 is here
  return false;
}

// === Western Mountains (秦岭/蜀道) ===

function isWesternMountain(q: number, r: number): boolean {
  // Qinling mountains: q from -5 to -3, r around -1 to 1
  if (q >= -5 && q <= -3 && r >= -1 && r <= 1) return true;
  // Shu road mountains: q <= -5, r from -2 to 1
  if (q <= -5 && r >= -2 && r <= 1) return true;
  return false;
}

// === Southern Forests ===

function isSouthernForest(q: number, r: number): boolean {
  return r <= -5;
}

// === Far West Desert ===

function isFarWestDesert(q: number, r: number): boolean {
  return q <= -7 && r >= 0;
}

// === Deterministic terrain based on geography ===

function createRng(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickGeographicTerrain(q: number, r: number, rng: () => number): TerrainType {
  const key = hexKey({ q, r });

  // City terrain overrides
  const override = CITY_TERRAIN_OVERRIDE.get(key);
  if (override) return override;

  // Yangtze River
  if (isYangtzeRiver(q, r)) return "water";

  // Far west desert
  if (isFarWestDesert(q, r)) {
    const roll = rng();
    return roll < 0.7 ? "desert" : roll < 0.9 ? "mountain" : "plains";
  }

  // Western mountains
  if (isWesternMountain(q, r)) {
    // Skip city tiles (already handled by override)
    const hasCityHere = PRESET_CITIES.some(
      (c) => c.coord.q === q && c.coord.r === r,
    );
    if (hasCityHere) return "plains";

    const roll = rng();
    return roll < 0.6 ? "mountain" : roll < 0.85 ? "forest" : "plains";
  }

  // Southern forests
  if (isSouthernForest(q, r)) {
    const hasCityHere = PRESET_CITIES.some(
      (c) => c.coord.q === q && c.coord.r === r,
    );
    if (hasCityHere) {
      // City tiles that aren't overridden are plains
      return "plains";
    }
    const roll = rng();
    return roll < 0.55 ? "forest" : roll < 0.8 ? "plains" : roll < 0.95 ? "mountain" : "water";
  }

  // Northern plains (r > 2)
  if (r > 2) {
    const hasCityHere = PRESET_CITIES.some(
      (c) => c.coord.q === q && c.coord.r === r,
    );
    if (hasCityHere) return "plains";

    const roll = rng();
    return roll < 0.7 ? "plains" : roll < 0.85 ? "forest" : roll < 0.95 ? "mountain" : "desert";
  }

  // Central/default area: mostly plains
  const hasCityHere = PRESET_CITIES.some(
    (c) => c.coord.q === q && c.coord.r === r,
  );
  if (hasCityHere) return "plains";

  const roll = rng();
  if (roll < 0.60) return "plains";
  if (roll < 0.85) return "forest";
  if (roll < 0.95) return "mountain";
  return "desert";
}

/**
 * Generate the fixed Three Kingdoms map.
 * Returns tiles with pre-set terrain based on geography.
 * Uses hex radius 12 (469 tiles).
 */
export function generateThreeKingdomsMap(): ReadonlyMap<string, Tile> {
  const coords = hexDisk({ q: 0, r: 0 }, MAP_SIZE);
  const tiles = new Map<string, Tile>();
  // Use a fixed seed for deterministic terrain fill
  const rng = createRng(314159);

  for (const coord of coords) {
    const terrain = pickGeographicTerrain(coord.q, coord.r, rng);
    tiles.set(hexKey(coord), {
      coord,
      terrain,
      owner: null,
      building: null,
      cityId: null,
    });
  }

  return tiles;
}
