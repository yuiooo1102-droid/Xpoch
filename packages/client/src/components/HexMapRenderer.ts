import type { Tile, Faction, Unit, City, Wonder, UnitType, BuildingType, NaturalResource } from "@xpoch/shared";
import { hexToPixel } from "../lib/hex-to-pixel";

// === Color constants ===

const TERRAIN_COLORS: Record<string, string> = {
  plains: "#7db87d",
  forest: "#2d7a2d",
  mountain: "#8a8a8a",
  water: "#3a6f9f",
  desert: "#d4a656",
};

const TERRAIN_ICONS: Record<string, string> = {
  plains: "\u{1F33E}",
  forest: "\u{1F332}",
  mountain: "\u{26F0}\uFE0F",
  water: "\u{1F30A}",
  desert: "\u{1F3DC}\uFE0F",
};

const UNIT_ICONS: Record<UnitType, string> = {
  infantry: "\u2694\uFE0F",
  cavalry: "\uD83D\uDC34",
  artillery: "\uD83D\uDCA3",
  scout: "\uD83D\uDD2D",
  settler: "\uD83C\uDFD5\uFE0F",
};

const BUILDING_ICONS: Record<BuildingType, string> = {
  barracks: "\uD83C\uDFF0",
  market: "\uD83E\uDE99",
  library: "\uD83D\uDCDA",
  granary: "\uD83C\uDF3E",
  workshop: "\u2692\uFE0F",
  city_walls: "\uD83E\uDDF1",
  harbor: "\u2693",
  fortress: "\uD83C\uDFF0",
  factory: "\uD83C\uDFED",
  airport: "\u2708\uFE0F",
};

const RESOURCE_ICONS: Record<NonNullable<NaturalResource>, string> = {
  iron: "\u26CF\uFE0F",
  horses: "\uD83D\uDC0E",
  saltpeter: "\uD83D\uDC8E",
  oil: "\uD83D\uDEE2\uFE0F",
};

// === Types ===

export interface RenderOptions {
  readonly hexSize: number;
  readonly offsetX: number;
  readonly offsetY: number;
}

interface RenderState {
  readonly tiles: ReadonlyMap<string, Tile>;
  readonly units: ReadonlyMap<string, Unit>;
  readonly cities: ReadonlyMap<string, City>;
  readonly factions: ReadonlyMap<string, Faction>;
  readonly wonders: readonly Wonder[];
}

interface UnitStack {
  readonly units: readonly Unit[];
  readonly factionId: string;
}

// === Main render function ===

export function renderHexMap(
  ctx: CanvasRenderingContext2D,
  state: RenderState,
  options: RenderOptions
): void {
  const { hexSize, offsetX, offsetY } = options;
  const { tiles, units, cities, factions } = state;

  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.fillStyle = "#111827";
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  // Pre-compute: units grouped by hex coordinate key
  const unitsByHex = buildUnitsByHex(units);

  // Pre-compute: city lookup by id
  const cityById = cities;

  // Pass 1: hex backgrounds, terrain, fog, outskirts
  for (const tile of tiles.values()) {
    const [px, py] = hexToPixel(tile.coord, hexSize);
    const x = px + offsetX;
    const y = py + offsetY;

    const baseColor = TERRAIN_COLORS[tile.terrain] ?? "#666";

    // Base terrain fill
    buildHexPath(ctx, x, y, hexSize);
    ctx.fillStyle = baseColor;
    ctx.fill();

    // Subtle inner gradient
    buildHexPath(ctx, x, y, hexSize);
    const grad = ctx.createRadialGradient(x, y, 0, x, y, hexSize);
    grad.addColorStop(0, "rgba(255,255,255,0.08)");
    grad.addColorStop(1, "rgba(0,0,0,0.15)");
    ctx.fillStyle = grad;
    ctx.fill();

    // City outskirt overlay (subtle faction border)
    const outskirtsCity = tile.isCityOutskirt ? cityById.get(tile.isCityOutskirt) : null;
    if (outskirtsCity) {
      const faction = factions.get(outskirtsCity.factionId);
      if (faction) {
        drawOutskirtOverlay(ctx, x, y, hexSize, faction.color);
      }
    }

    // Fog of war: darken tiles not owned by any faction
    const tileHasOwner = tile.cityId !== null || tile.isCityOutskirt !== null;
    if (!tileHasOwner) {
      buildHexPath(ctx, x, y, hexSize);
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.fill();
    }

    // Hex border
    buildHexPath(ctx, x, y, hexSize);
    ctx.strokeStyle = tileHasOwner ? "#ffffff25" : "#00000050";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Pass 2: icons and overlays
  for (const tile of tiles.values()) {
    const [px, py] = hexToPixel(tile.coord, hexSize);
    const x = px + offsetX;
    const y = py + offsetY;

    const hexKey = coordKey(tile.coord.q, tile.coord.r);

    // City icon
    if (tile.cityId) {
      const city = cityById.get(tile.cityId);
      if (city) {
        const faction = factions.get(city.factionId);
        const color = faction?.color ?? "#fff";
        drawCityIcon(ctx, x, y, hexSize, city.isCapital, color);
      }
    }

    // Natural resource icon (bottom-right of hex)
    if (tile.naturalResource) {
      drawResourceIcon(ctx, x, y, hexSize, tile.naturalResource);
    }

    // Building icon (top-left of hex)
    if (tile.building) {
      drawBuildingIcon(ctx, x, y, hexSize, tile.building);
    }

    // Units on this hex
    const stack = unitsByHex.get(hexKey);
    if (stack) {
      drawUnitStack(ctx, x, y, hexSize, stack, factions);
    }

    // Terrain icon for empty tiles (no city, no units, no building)
    if (!tile.cityId && !stack && !tile.building) {
      drawTerrainIcon(ctx, x, y, hexSize, tile.terrain);
    }
  }
}

// === Helper: build unit index by hex ===

function coordKey(q: number, r: number): string {
  return `${q},${r}`;
}

function buildUnitsByHex(
  units: ReadonlyMap<string, Unit>
): ReadonlyMap<string, UnitStack> {
  const map = new Map<string, { units: Unit[]; factionId: string }>();
  for (const unit of units.values()) {
    const key = coordKey(unit.coord.q, unit.coord.r);
    const existing = map.get(key);
    if (existing) {
      map.set(key, {
        units: [...existing.units, unit],
        factionId: existing.factionId,
      });
    } else {
      map.set(key, {
        units: [unit],
        factionId: unit.factionId,
      });
    }
  }
  return map;
}

// === Drawing helpers ===

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
  ctx.font = `${hexSize * 0.4}px serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.globalAlpha = 0.5;
  ctx.fillText(icon, x, y + 1);
  ctx.restore();
}

function drawCityIcon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  hexSize: number,
  isCapital: boolean,
  factionColor: string
): void {
  ctx.save();

  if (isCapital) {
    // Capital: large star with glow
    ctx.shadowColor = factionColor;
    ctx.shadowBlur = hexSize * 0.6;
    ctx.font = `bold ${hexSize * 0.7}px serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = factionColor;
    ctx.fillText("\u2605", x, y);
    ctx.shadowBlur = 0;
  } else {
    // Regular city: filled circle
    ctx.beginPath();
    ctx.arc(x, y, hexSize * 0.25, 0, Math.PI * 2);
    ctx.fillStyle = factionColor;
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  ctx.restore();
}

function drawOutskirtOverlay(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  hexSize: number,
  factionColor: string
): void {
  // Subtle faction-colored fill
  buildHexPath(ctx, x, y, hexSize);
  ctx.fillStyle = factionColor + "30";
  ctx.fill();

  // Faction-colored border
  buildHexPath(ctx, x, y, hexSize);
  ctx.strokeStyle = factionColor + "60";
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawResourceIcon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  hexSize: number,
  resource: NonNullable<NaturalResource>
): void {
  const icon = RESOURCE_ICONS[resource];
  if (!icon) return;

  ctx.save();
  ctx.font = `${hexSize * 0.3}px serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(icon, x + hexSize * 0.35, y + hexSize * 0.35);
  ctx.restore();
}

function drawBuildingIcon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  hexSize: number,
  building: string
): void {
  const icon = BUILDING_ICONS[building as BuildingType];
  if (!icon) return;

  ctx.save();
  ctx.font = `${hexSize * 0.28}px serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(icon, x - hexSize * 0.35, y - hexSize * 0.35);
  ctx.restore();
}

function drawUnitStack(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  hexSize: number,
  stack: UnitStack,
  factions: ReadonlyMap<string, Faction>
): void {
  const { units: stackUnits, factionId } = stack;
  const faction = factions.get(factionId);
  const factionColor = faction?.color ?? "#fff";

  if (stackUnits.length === 0) return;

  // Draw primary unit icon (first unit in stack)
  const primary = stackUnits[0];
  const icon = UNIT_ICONS[primary.type];

  // Background badge
  const badgeRadius = hexSize * 0.35;
  ctx.beginPath();
  ctx.arc(x, y, badgeRadius, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0,0,0,0.7)";
  ctx.fill();
  ctx.strokeStyle = factionColor;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Unit type icon
  ctx.save();
  ctx.font = `${hexSize * 0.32}px serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(icon, x, y - badgeRadius * 0.2);
  ctx.restore();

  // Strength number
  const totalStrength = stackUnits.reduce((sum, u) => sum + u.strength, 0);
  ctx.fillStyle = "#ffffff";
  ctx.font = `bold ${Math.max(9, hexSize * 0.26)}px monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = "#000";
  ctx.shadowBlur = 2;
  ctx.fillText(String(totalStrength), x, y + badgeRadius * 0.5);
  ctx.shadowBlur = 0;

  // Stack count badge (top-right) when multiple units
  if (stackUnits.length > 1) {
    drawStackCountBadge(ctx, x, y, hexSize, stackUnits.length, factionColor);
  }
}

function drawStackCountBadge(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  hexSize: number,
  count: number,
  factionColor: string
): void {
  const bx = x + hexSize * 0.3;
  const by = y - hexSize * 0.3;
  const r = hexSize * 0.16;

  ctx.save();
  ctx.beginPath();
  ctx.arc(bx, by, r, 0, Math.PI * 2);
  ctx.fillStyle = factionColor;
  ctx.fill();
  ctx.strokeStyle = "#000";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = "#fff";
  ctx.font = `bold ${Math.max(8, hexSize * 0.2)}px monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(count), bx, by);
  ctx.restore();
}

// === Geometry ===

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
