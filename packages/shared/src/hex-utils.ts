import type { HexCoord } from "./types";

export function hexKey(coord: HexCoord): string {
  return `${coord.q},${coord.r}`;
}

export function parseHexKey(key: string): HexCoord {
  const [q, r] = key.split(",").map(Number);
  return { q, r };
}

const DIRECTIONS: readonly HexCoord[] = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
];

export function hexNeighbors(coord: HexCoord): HexCoord[] {
  return DIRECTIONS.map((d) => ({ q: coord.q + d.q, r: coord.r + d.r }));
}

export function hexDistance(a: HexCoord, b: HexCoord): number {
  return Math.max(
    Math.abs(a.q - b.q),
    Math.abs(a.r - b.r),
    Math.abs(a.q + a.r - b.q - b.r)
  );
}

export function hexRing(center: HexCoord, radius: number): HexCoord[] {
  if (radius === 0) return [{ ...center }];

  const results: HexCoord[] = [];
  let current: HexCoord = {
    q: center.q + DIRECTIONS[4].q * radius,
    r: center.r + DIRECTIONS[4].r * radius,
  };

  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < radius; j++) {
      results.push({ ...current });
      current = {
        q: current.q + DIRECTIONS[i].q,
        r: current.r + DIRECTIONS[i].r,
      };
    }
  }

  return results;
}

export function hexDisk(center: HexCoord, radius: number): HexCoord[] {
  const results: HexCoord[] = [];
  for (let r = 0; r <= radius; r++) {
    results.push(...hexRing(center, r));
  }
  return results;
}
