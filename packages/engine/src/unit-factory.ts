import type { Unit, UnitType, FactionId, HexCoord } from "@xpoch/shared";
import { UNIT_STATS } from "@xpoch/shared";

interface UpgradeOverrides {
  readonly strength: number;
  readonly movement?: number;
}

const UPGRADE_OVERRIDES: Partial<Record<UnitType, UpgradeOverrides>> = {
  infantry: { strength: 5 },
  cavalry: { strength: 5, movement: 3 },
  artillery: { strength: 6 },
};

let unitCounter = 0;

/**
 * Generate a unique unit ID.
 */
export function generateUnitId(): string {
  unitCounter += 1;
  const timestamp = Date.now().toString(36);
  const counter = unitCounter.toString(36);
  const random = Math.random().toString(36).slice(2, 6);
  return `u_${timestamp}_${counter}_${random}`;
}

/**
 * Create a new unit with appropriate stats based on type.
 * Uses UNIT_STATS from constants for base stats.
 * Upgraded units receive enhanced stats based on tech bonuses.
 */
export function createUnit(
  factionId: FactionId,
  type: UnitType,
  coord: HexCoord,
  upgraded?: boolean,
): Unit {
  const base = UNIT_STATS[type];
  const isUpgraded = upgraded === true;

  const overrides = isUpgraded ? UPGRADE_OVERRIDES[type] : undefined;
  const strength = overrides?.strength ?? base.strength;
  const movement = overrides?.movement ?? base.movement;

  return {
    id: generateUnitId(),
    factionId,
    type,
    coord: { q: coord.q, r: coord.r },
    strength,
    maxStrength: strength,
    movement,
    maxMovement: movement,
    upgraded: isUpgraded,
  };
}
