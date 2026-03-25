import type {
  GameState,
  FactionId,
  MilitaryOrder,
  CityOrder,
  DiplomacyOrder,
  HexCoord,
} from "@xpoch/shared";
import {
  hexKey,
  hexDistance,
  UNIT_STATS,
  BUILDING_STATS,
  RUSH_GOLD_MULTIPLIER,
  TERRAIN_MOVEMENT_COST,
} from "@xpoch/shared";
import { hasTech } from "./tech-tree";

// === Types ===

export interface ValidationResult {
  readonly valid: boolean;
  readonly reason?: string;
}

const OK: ValidationResult = { valid: true };

function fail(reason: string): ValidationResult {
  return { valid: false, reason };
}

// === Military validation ===

export function validateMilitaryOrder(
  state: GameState,
  order: MilitaryOrder,
  factionId: FactionId,
): ValidationResult {
  const unit = state.units.get(order.unitId);
  if (!unit) return fail("Unit does not exist");
  if (unit.factionId !== factionId) return fail("Unit does not belong to faction");

  switch (order.action) {
    case "move":
      return validateMove(state, unit.coord, order.to, unit.movement, factionId);
    case "attack":
      return validateAttack(state, unit.coord, order.to, factionId);
    case "fortify":
      return OK;
    case "disband":
      return OK;
    default:
      return fail(`Unknown military action: ${order.action}`);
  }
}

function validateMove(
  state: GameState,
  from: HexCoord,
  to: HexCoord | undefined,
  movement: number,
  factionId: FactionId,
): ValidationResult {
  if (!to) return fail("Move requires target hex");

  const dist = hexDistance(from, to);
  if (dist === 0) return fail("Cannot move to current position");
  if (dist > movement) return fail("Target hex is out of movement range");

  const targetTile = state.tiles.get(hexKey(to));
  if (!targetTile) return fail("Target hex does not exist");

  if (targetTile.terrain === "water" && !hasTech(state, factionId, "navigation")) {
    return fail("Cannot move to water without navigation tech");
  }

  // Check for enemy units at target
  for (const u of state.units.values()) {
    if (hexKey(u.coord) === hexKey(to) && u.factionId !== factionId) {
      return fail("Cannot move into hex with enemy units — use attack instead");
    }
  }

  return OK;
}

function validateAttack(
  state: GameState,
  from: HexCoord,
  to: HexCoord | undefined,
  factionId: FactionId,
): ValidationResult {
  if (!to) return fail("Attack requires target hex");

  const dist = hexDistance(from, to);
  if (dist === 0) return fail("Cannot attack own position");
  if (dist > 1) return fail("Attack target must be adjacent");

  const targetTile = state.tiles.get(hexKey(to));
  if (!targetTile) return fail("Target hex does not exist");

  // Must have enemy units or enemy city at target
  const targetKey = hexKey(to);
  let hasEnemyPresence = false;

  for (const u of state.units.values()) {
    if (hexKey(u.coord) === targetKey && u.factionId !== factionId) {
      hasEnemyPresence = true;
      break;
    }
  }

  if (!hasEnemyPresence) {
    // Check for enemy city
    for (const city of state.cities.values()) {
      if (hexKey(city.coord) === targetKey && city.factionId !== factionId) {
        hasEnemyPresence = true;
        break;
      }
    }
  }

  if (!hasEnemyPresence) {
    return fail("No enemy units or city at attack target");
  }

  return OK;
}

// === City validation ===

export function validateCityOrder(
  state: GameState,
  order: CityOrder,
  factionId: FactionId,
): ValidationResult {
  const city = state.cities.get(order.cityId);
  if (!city) return fail("City does not exist");
  if (city.factionId !== factionId) return fail("City does not belong to faction");

  const faction = state.factions.get(factionId);
  if (!faction) return fail("Faction does not exist");

  switch (order.action) {
    case "train":
      return validateTrain(state, faction, order.target);
    case "build":
      return validateBuild(state, factionId, order.target, order.hex);
    case "rush":
      return validateRush(city, faction);
    case "idle":
      return OK;
    default:
      return fail(`Unknown city action: ${order.action}`);
  }
}

function validateTrain(
  state: GameState,
  faction: { readonly gold: number },
  target: string | undefined,
): ValidationResult {
  if (!target) return fail("Train requires a unit type target");

  const stats = UNIT_STATS[target as keyof typeof UNIT_STATS];
  if (!stats) return fail(`Unknown unit type: ${target}`);

  if (faction.gold < stats.cost) {
    return fail("Not enough gold to train unit");
  }

  return OK;
}

function validateBuild(
  state: GameState,
  factionId: FactionId,
  target: string | undefined,
  hex: HexCoord | undefined,
): ValidationResult {
  if (!target) return fail("Build requires a building type target");

  const stats = BUILDING_STATS[target as keyof typeof BUILDING_STATS];
  if (!stats) return fail(`Unknown building type: ${target}`);

  // Check tech requirement
  if (stats.requiresTech && !hasTech(state, factionId, stats.requiresTech)) {
    return fail(`Building requires tech: ${stats.requiresTech}`);
  }

  // Check terrain if hex specified
  if (hex) {
    const tile = state.tiles.get(hexKey(hex));
    if (!tile) return fail("Target hex does not exist");

    if (!stats.anyLand) {
      if (!stats.terrains.includes(tile.terrain)) {
        return fail(`Building cannot be placed on ${tile.terrain}`);
      }
    } else if (tile.terrain === "water") {
      return fail("Cannot place land building on water");
    }
  }

  return OK;
}

function validateRush(
  city: { readonly currentProject: { readonly cost: number; readonly invested: number } | null },
  faction: { readonly gold: number },
): ValidationResult {
  if (!city.currentProject) {
    return fail("City has no active project to rush");
  }

  const remaining = city.currentProject.cost - city.currentProject.invested;
  const rushCost = remaining * RUSH_GOLD_MULTIPLIER;

  if (faction.gold < rushCost) {
    return fail("Not enough gold to rush production");
  }

  return OK;
}

// === Diplomacy validation ===

export function validateDiplomacyOrder(
  state: GameState,
  order: DiplomacyOrder,
  factionId: FactionId,
): ValidationResult {
  if (order.targetFactionId === factionId) {
    return fail("Cannot target own faction");
  }

  const target = state.factions.get(order.targetFactionId);
  if (!target || !target.alive) {
    return fail("Target faction not found or eliminated");
  }

  const faction = state.factions.get(factionId);
  if (!faction) return fail("Faction does not exist");

  switch (order.action) {
    case "send_gold": {
      if (!order.amount || order.amount <= 0) return fail("send_gold requires a positive amount");
      if (faction.gold < order.amount) return fail("Not enough gold to send");
      return OK;
    }
    case "demand_tribute": {
      if (!order.amount || order.amount <= 0) return fail("demand_tribute requires a positive amount");
      return OK;
    }
    case "declare_war":
    case "propose_alliance":
    case "break_alliance":
    case "offer_peace":
      return OK;
    default:
      return fail(`Unknown diplomacy action: ${order.action}`);
  }
}
