import type { Tile, Faction } from "@xpoch/shared";
import { hexToPixel } from "../lib/hex-to-pixel";

const TERRAIN_COLORS: Record<string, string> = {
  plains: "#8FBC8F",
  forest: "#228B22",
  mountain: "#808080",
  water: "#4682B4",
  desert: "#DEB887",
};

export interface RenderOptions {
  readonly hexSize: number;
  readonly offsetX: number;
  readonly offsetY: number;
}

export function renderHexMap(
  ctx: CanvasRenderingContext2D,
  tiles: ReadonlyMap<string, Tile>,
  factions: ReadonlyMap<string, Faction>,
  options: RenderOptions
): void {
  const { hexSize, offsetX, offsetY } = options;

  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.fillStyle = "#1a1a2e";
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  for (const tile of tiles.values()) {
    const [px, py] = hexToPixel(tile.coord, hexSize);
    const x = px + offsetX;
    const y = py + offsetY;

    drawHex(ctx, x, y, hexSize, TERRAIN_COLORS[tile.terrain] ?? "#666");

    if (tile.owner) {
      const faction = factions.get(tile.owner);
      if (faction) {
        ctx.fillStyle = faction.color + "60";
        ctx.fill();
      }
    }

    if (tile.army > 0) {
      ctx.fillStyle = "#ffffff";
      ctx.font = `bold ${Math.max(10, hexSize / 3)}px monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(tile.army), x, y);
    }
  }
}

function drawHex(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  fillColor: string
): void {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i - 30);
    const hx = x + size * Math.cos(angle);
    const hy = y + size * Math.sin(angle);
    if (i === 0) ctx.moveTo(hx, hy);
    else ctx.lineTo(hx, hy);
  }
  ctx.closePath();
  ctx.fillStyle = fillColor;
  ctx.fill();
  ctx.strokeStyle = "#333";
  ctx.lineWidth = 1;
  ctx.stroke();
}
