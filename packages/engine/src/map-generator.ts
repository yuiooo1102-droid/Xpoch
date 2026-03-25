import type { Tile, TerrainType } from "@xpoch/shared";
import { hexDisk, hexKey, TERRAIN_RESOURCES } from "@xpoch/shared";

function createRng(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TERRAIN_WEIGHTS: readonly { terrain: TerrainType; weight: number }[] = [
  { terrain: "plains", weight: 35 },
  { terrain: "forest", weight: 25 },
  { terrain: "mountain", weight: 15 },
  { terrain: "water", weight: 10 },
  { terrain: "desert", weight: 15 },
];

function pickTerrain(rng: () => number): TerrainType {
  const total = TERRAIN_WEIGHTS.reduce((sum, tw) => sum + tw.weight, 0);
  let roll = rng() * total;
  for (const tw of TERRAIN_WEIGHTS) {
    roll -= tw.weight;
    if (roll <= 0) return tw.terrain;
  }
  return "plains";
}

export function generateMap(
  radius: number,
  seed: number
): ReadonlyMap<string, Tile> {
  const rng = createRng(seed);
  const coords = hexDisk({ q: 0, r: 0 }, radius);
  const tiles = new Map<string, Tile>();

  for (const coord of coords) {
    const terrain = pickTerrain(rng);
    tiles.set(hexKey(coord), {
      coord,
      terrain,
      owner: null,
      army: 0,
      resources: TERRAIN_RESOURCES[terrain] ?? 0,
    });
  }

  return tiles;
}
