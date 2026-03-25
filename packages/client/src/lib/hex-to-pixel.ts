import type { HexCoord } from "@xpoch/shared";

export function hexToPixel(
  coord: HexCoord,
  size: number
): [x: number, y: number] {
  const x = size * (3 / 2) * coord.q;
  const y = size * (Math.sqrt(3) / 2 * coord.q + Math.sqrt(3) * coord.r);
  return [x, y];
}

export function pixelToHex(
  x: number,
  y: number,
  size: number
): HexCoord {
  const q = (2 / 3) * x / size;
  const r = (-1 / 3 * x + Math.sqrt(3) / 3 * y) / size;
  return hexRound(q, r);
}

function hexRound(q: number, r: number): HexCoord {
  const s = -q - r;
  let rq = Math.round(q);
  let rr = Math.round(r);
  const rs = Math.round(s);

  const dq = Math.abs(rq - q);
  const dr = Math.abs(rr - r);
  const ds = Math.abs(rs - s);

  if (dq > dr && dq > ds) {
    rq = -rr - rs;
  } else if (dr > ds) {
    rr = -rq - rs;
  }

  return { q: rq, r: rr };
}
