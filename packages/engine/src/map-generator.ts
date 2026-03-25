import type { Tile, TerrainType, NaturalResource } from "@xpoch/shared";
import { hexDisk, hexKey } from "@xpoch/shared";

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

/** Which natural resources can appear on each terrain type */
const RESOURCE_BY_TERRAIN: Record<TerrainType, readonly NaturalResource[]> = {
  plains: ["horses", "saltpeter"],
  forest: ["iron"],
  mountain: ["iron", "oil"],
  water: [],
  desert: ["saltpeter", "oil"],
};

/** Probability that an eligible land tile receives a natural resource (~15%) */
const RESOURCE_CHANCE = 0.15;

function pickNaturalResource(
  terrain: TerrainType,
  rng: () => number,
): NaturalResource {
  const candidates = RESOURCE_BY_TERRAIN[terrain];
  if (candidates.length === 0) return null;
  if (rng() > RESOURCE_CHANCE) return null;
  return candidates[Math.floor(rng() * candidates.length)] ?? null;
}

export function generateMap(
  radius: number,
  seed: number,
): ReadonlyMap<string, Tile> {
  const rng = createRng(seed);
  const coords = hexDisk({ q: 0, r: 0 }, radius);
  const tiles = new Map<string, Tile>();

  for (const coord of coords) {
    const terrain = pickTerrain(rng);
    const naturalResource = pickNaturalResource(terrain, rng);

    tiles.set(hexKey(coord), {
      coord,
      terrain,
      owner: null,
      naturalResource,
      building: null,
      cityId: null,
      isCityOutskirt: null,
    });
  }

  return tiles;
}
