import type {
  GameState,
  FactionId,
  ArmyOrder,
  CityOrder,
  BuildOrder,
  DiplomacyOrder,
  Resources,
} from "@xpoch/shared";
import {
  hexKey,
  hexDistance,
  TROOP_STATS,
  BUILDING_DEFS,
  CITY_UPGRADE_COST,
  WALL_UPGRADE_COST,
  MAX_CITY_LEVEL,
  MAX_WALLS,
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

function canAfford(have: Resources, cost: Resources): boolean {
  return (
    have.gold >= cost.gold &&
    have.food >= cost.food &&
    have.wood >= cost.wood &&
    have.iron >= cost.iron
  );
}

// === Army Order validation ===

export function validateArmyOrder(
  state: GameState,
  order: ArmyOrder,
  factionId: FactionId,
): ValidationResult {
  // Find the army led by this general
  const army = [...state.armies.values()].find(
    (a) => a.generalId === order.generalId && a.factionId === factionId,
  );

  switch (order.action) {
    case "idle":
      return OK;

    case "march": {
      if (!army) return fail("No army found for this general");
      if (!order.target) return fail("March requires a target hex");

      const targetTile = state.tiles.get(hexKey(order.target));
      if (!targetTile) return fail("Target hex does not exist");

      if (targetTile.terrain === "water") {
        return fail("Cannot march to water");
      }

      return OK;
    }

    case "attack": {
      if (!army) return fail("No army found for this general");
      if (!order.target) return fail("Attack requires a target hex");

      const dist = hexDistance(army.coord, order.target);
      if (dist > 1) return fail("Attack target must be adjacent (distance 1)");

      const targetKey = hexKey(order.target);
      let hasEnemyPresence = false;

      // Check for enemy armies
      for (const a of state.armies.values()) {
        if (hexKey(a.coord) === targetKey && a.factionId !== factionId) {
          hasEnemyPresence = true;
          break;
        }
      }

      // Check for enemy city
      if (!hasEnemyPresence) {
        for (const city of state.cities.values()) {
          if (hexKey(city.coord) === targetKey && city.factionId !== factionId) {
            hasEnemyPresence = true;
            break;
          }
        }
      }

      if (!hasEnemyPresence) {
        return fail("No enemy army or city at attack target");
      }

      return OK;
    }

    case "retreat": {
      if (!army) return fail("No army found for this general");
      return OK;
    }

    case "garrison": {
      if (!army) return fail("No army found for this general");

      // Must be at a friendly city
      const armyKey = hexKey(army.coord);
      let atFriendlyCity = false;
      for (const city of state.cities.values()) {
        if (hexKey(city.coord) === armyKey && city.factionId === factionId) {
          atFriendlyCity = true;
          break;
        }
      }

      if (!atFriendlyCity) {
        return fail("Army must be at a friendly city to garrison");
      }

      return OK;
    }

    default:
      return fail(`Unknown army action: ${(order as ArmyOrder).action}`);
  }
}

// === City Order validation ===

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
    case "train": {
      if (!order.troopType) return fail("Train requires a troop type");

      const stats = TROOP_STATS[order.troopType];
      if (!stats) return fail(`Unknown troop type: ${order.troopType}`);

      if (city.trainingQueue !== null) {
        return fail("City already has a training queue");
      }

      // Check resource cost: trainCost is per 100 troops
      const amount = order.amount ?? 100;
      const batchCount = amount / 100;
      const cost: Resources = {
        gold: stats.trainCost.gold * batchCount,
        food: stats.trainCost.food * batchCount,
        wood: stats.trainCost.wood * batchCount,
        iron: stats.trainCost.iron * batchCount,
      };

      if (!canAfford(faction.resources, cost)) {
        return fail("Not enough resources to train troops");
      }

      return OK;
    }

    case "upgrade_walls": {
      if (city.walls >= MAX_WALLS) {
        return fail("Walls already at maximum level");
      }
      if (!canAfford(faction.resources, WALL_UPGRADE_COST)) {
        return fail("Not enough resources to upgrade walls");
      }
      return OK;
    }

    case "upgrade_city": {
      if (city.level >= MAX_CITY_LEVEL) {
        return fail("City already at maximum level");
      }
      if (!canAfford(faction.resources, CITY_UPGRADE_COST)) {
        return fail("Not enough resources to upgrade city");
      }
      return OK;
    }

    case "idle":
      return OK;

    default:
      return fail(`Unknown city action: ${(order as CityOrder).action}`);
  }
}

// === Build Order validation ===

export function validateBuildOrder(
  state: GameState,
  order: BuildOrder,
  factionId: FactionId,
): ValidationResult {
  const tile = state.tiles.get(hexKey(order.hex));
  if (!tile) return fail("Target hex does not exist");
  if (tile.owner !== factionId) return fail("Tile is not owned by faction");
  if (tile.building !== null) return fail("Tile already has a building");
  if (tile.cityId !== null) return fail("Cannot build on a city center tile");

  const buildingDef = BUILDING_DEFS[order.building];
  if (!buildingDef) return fail(`Unknown building type: ${order.building}`);

  // Check terrain
  if (buildingDef.terrain === "any_land") {
    if (tile.terrain === "water") {
      return fail("Cannot place land building on water");
    }
  } else {
    if (!buildingDef.terrain.includes(tile.terrain)) {
      return fail(`Building cannot be placed on ${tile.terrain}`);
    }
  }

  // Check tech requirement
  if (buildingDef.requiresTech && !hasTech(state, factionId, buildingDef.requiresTech)) {
    return fail(`Building requires tech: ${buildingDef.requiresTech}`);
  }

  // Check cost
  const faction = state.factions.get(factionId);
  if (!faction) return fail("Faction does not exist");
  if (!canAfford(faction.resources, buildingDef.cost)) {
    return fail("Not enough resources to build");
  }

  return OK;
}

// === Diplomacy Order validation ===

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
    case "send_tribute": {
      if (!order.amount || order.amount <= 0) {
        return fail("send_tribute requires a positive amount");
      }
      if (faction.resources.gold < order.amount) {
        return fail("Not enough gold to send as tribute");
      }
      return OK;
    }
    case "declare_war":
    case "propose_alliance":
    case "break_alliance":
    case "offer_peace":
      return OK;
    default:
      return fail(`Unknown diplomacy action: ${(order as DiplomacyOrder).action}`);
  }
}
