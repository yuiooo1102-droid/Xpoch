import type { Tile, Faction } from "@xpoch/shared";
import { hexToPixel } from "../lib/hex-to-pixel";

const TERRAIN_COLORS: Record<string, string> = {
  plains: "#7db87d",
  forest: "#2d7a2d",
  mountain: "#8a8a8a",
  water: "#3a6f9f",
  desert: "#d4a656",
};

const TERRAIN_ICONS: Record<string, string> = {
  plains: "\u{1F33E}",   // sheaf of rice
  forest: "\u{1F332}",   // evergreen tree
  mountain: "\u{26F0}\uFE0F", // mountain
  water: "\u{1F30A}",    // wave
  desert: "\u{1F3DC}\uFE0F",  // desert
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
  ctx.fillStyle = "#111827";
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  // First pass: draw all hex backgrounds + terrain
  for (const tile of tiles.values()) {
    const [px, py] = hexToPixel(tile.coord, hexSize);
    const x = px + offsetX;
    const y = py + offsetY;

    const baseColor = TERRAIN_COLORS[tile.terrain] ?? "#666";

    // Base terrain fill
    buildHexPath(ctx, x, y, hexSize);
    ctx.fillStyle = baseColor;
    ctx.fill();

    // Subtle inner gradient effect
    buildHexPath(ctx, x, y, hexSize);
    const grad = ctx.createRadialGradient(x, y, 0, x, y, hexSize);
    grad.addColorStop(0, "rgba(255,255,255,0.08)");
    grad.addColorStop(1, "rgba(0,0,0,0.15)");
    ctx.fillStyle = grad;
    ctx.fill();

    // Faction ownership overlay
    if (tile.owner) {
      const faction = factions.get(tile.owner);
      if (faction) {
        buildHexPath(ctx, x, y, hexSize);
        ctx.fillStyle = faction.color + "90";
        ctx.fill();

        // Diagonal stripe pattern for owned territory
        drawOwnershipStripes(ctx, x, y, hexSize, faction.color);
      }
    }

    // Hex border
    buildHexPath(ctx, x, y, hexSize);
    ctx.strokeStyle = tile.owner ? "#ffffff25" : "#00000050";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Second pass: draw icons, armies, flags on top
  for (const tile of tiles.values()) {
    const [px, py] = hexToPixel(tile.coord, hexSize);
    const x = px + offsetX;
    const y = py + offsetY;

    if (tile.army > 0 && tile.owner) {
      const faction = factions.get(tile.owner);
      if (faction) {
        drawArmyBadge(ctx, x, y, hexSize, tile.army, faction.color);
        drawFactionFlag(ctx, x, y, hexSize, faction.color);
      }
    } else {
      // Terrain icon for unoccupied tiles
      drawTerrainIcon(ctx, x, y, hexSize, tile.terrain);
    }
  }
}

function drawTerrainIcon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  hexSize: number,
  terrain: string
): void {
  const icon = TERRAIN_ICONS[terrain];
  if (!icon) return;

  ctx.save();
  ctx.font = `${hexSize * 0.45}px serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.globalAlpha = 0.6;
  ctx.fillText(icon, x, y + 1);
  ctx.restore();
}

function drawArmyBadge(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  hexSize: number,
  army: number,
  factionColor: string
): void {
  const badgeRadius = hexSize * 0.35;

  // Badge background circle
  ctx.beginPath();
  ctx.arc(x, y, badgeRadius, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0,0,0,0.7)";
  ctx.fill();
  ctx.strokeStyle = factionColor;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Shield icon above number
  drawShield(ctx, x, y - badgeRadius * 0.25, badgeRadius * 0.4, factionColor);

  // Army count
  ctx.fillStyle = "#ffffff";
  ctx.font = `bold ${Math.max(10, hexSize * 0.32)}px monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = "#000";
  ctx.shadowBlur = 2;
  ctx.fillText(String(army), x, y + badgeRadius * 0.3);
  ctx.shadowBlur = 0;
}

function drawShield(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string
): void {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x - size, y - size * 0.6);
  ctx.lineTo(x - size, y + size * 0.2);
  ctx.quadraticCurveTo(x, y + size * 1.2, x, y + size * 1.2);
  ctx.quadraticCurveTo(x, y + size * 1.2, x + size, y + size * 0.2);
  ctx.lineTo(x + size, y - size * 0.6);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.9;
  ctx.fill();
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}

function drawFactionFlag(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  hexSize: number,
  color: string
): void {
  const flagX = x + hexSize * 0.35;
  const flagY = y - hexSize * 0.45;
  const flagW = hexSize * 0.28;
  const flagH = hexSize * 0.2;

  ctx.save();
  // Pole
  ctx.beginPath();
  ctx.moveTo(flagX, flagY - flagH * 0.5);
  ctx.lineTo(flagX, flagY + flagH * 1.2);
  ctx.strokeStyle = "#ccc";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Flag triangle
  ctx.beginPath();
  ctx.moveTo(flagX, flagY - flagH * 0.5);
  ctx.lineTo(flagX + flagW, flagY);
  ctx.lineTo(flagX, flagY + flagH * 0.5);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = "#ffffff60";
  ctx.lineWidth = 0.5;
  ctx.stroke();
  ctx.restore();
}

function drawOwnershipStripes(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  hexSize: number,
  color: string
): void {
  ctx.save();
  buildHexPath(ctx, x, y, hexSize);
  ctx.clip();

  ctx.strokeStyle = color + "20";
  ctx.lineWidth = 1;
  const step = hexSize * 0.3;
  for (let i = -hexSize; i < hexSize; i += step) {
    ctx.beginPath();
    ctx.moveTo(x + i - hexSize, y - hexSize);
    ctx.lineTo(x + i + hexSize, y + hexSize);
    ctx.stroke();
  }
  ctx.restore();
}

function buildHexPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number
): void {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i);
    const hx = x + size * Math.cos(angle);
    const hy = y + size * Math.sin(angle);
    if (i === 0) ctx.moveTo(hx, hy);
    else ctx.lineTo(hx, hy);
  }
  ctx.closePath();
}
