import type {
  GameState,
  FactionId,
  Resources,
  Troops,
  TroopType,
} from "@xpoch/shared";
import {
  TERRAIN_INCOME,
  BUILDING_DEFS,
  TROOP_STATS,
  FOOD_PER_100_TROOPS,
} from "@xpoch/shared";
import {
  updateFaction,
  updateCity,
  addLogEntry,
  getFactionCities,
  getFactionArmies,
} from "./game-state";

// === Constants ===

const STARVATION_DESERTION_RATE = 0.1; // 10% of troops desert when food < 0
const TROOP_TYPES: readonly TroopType[] = ["infantry", "cavalry", "archer"];

// === Helpers ===

function totalTroopsCount(troops: Troops): number {
  return troops.infantry + troops.cavalry + troops.archer;
}

function addPartialResources(a: Resources, b: Partial<Resources>): Resources {
  return {
    gold: a.gold + (b.gold ?? 0),
    food: a.food + (b.food ?? 0),
    wood: a.wood + (b.wood ?? 0),
    iron: a.iron + (b.iron ?? 0),
  };
}

function applyDesertionToTroops(troops: Troops, rate: number): Troops {
  return {
    infantry: Math.max(0, troops.infantry - Math.ceil(troops.infantry * rate)),
    cavalry: Math.max(0, troops.cavalry - Math.ceil(troops.cavalry * rate)),
    archer: Math.max(0, troops.archer - Math.ceil(troops.archer * rate)),
  };
}

// === Public API ===

/**
 * Calculate total resource income for a faction this tick.
 * Iterates all tiles where tile.owner === factionId,
 * sums TERRAIN_INCOME[terrain] + building income if building exists.
 */
export function calculateIncome(
  state: GameState,
  factionId: FactionId,
): Resources {
  let income: Resources = { gold: 0, food: 0, wood: 0, iron: 0 };

  for (const tile of state.tiles.values()) {
    if (tile.owner !== factionId) continue;

    const terrainIncome = TERRAIN_INCOME[tile.terrain];
    income = addPartialResources(income, terrainIncome);

    if (tile.building !== null) {
      const buildingDef = BUILDING_DEFS[tile.building];
      income = addPartialResources(income, buildingDef.income);
    }
  }

  return income;
}

/**
 * Calculate food upkeep for a faction this tick.
 * Total troops = sum of all army troops + all city garrison troops.
 * Food consumed = (totalTroops / 100) * FOOD_PER_100_TROOPS per tick.
 */
export function calculateUpkeep(
  state: GameState,
  factionId: FactionId,
): Resources {
  let totalTroops = 0;

  // Count army troops
  for (const army of state.armies.values()) {
    if (army.factionId === factionId) {
      totalTroops += totalTroopsCount(army.troops);
    }
  }

  // Count city garrison troops
  for (const city of state.cities.values()) {
    if (city.factionId === factionId) {
      totalTroops += totalTroopsCount(city.garrison);
    }
  }

  const foodConsumed = Math.ceil((totalTroops / 100) * FOOD_PER_100_TROOPS);

  return { gold: 0, food: foodConsumed, wood: 0, iron: 0 };
}

/**
 * Process economy for one tick:
 * 1. Territory income: each owned tile produces based on TERRAIN_INCOME + building income
 * 2. Food consumption: total troops x FOOD_PER_100_TROOPS / 100
 * 3. Starvation: if food < 0, troops desert (lose 10% of all troops)
 * 4. City production: process training queues
 * 5. Eliminate factions with 0 cities
 */
export function processEconomy(state: GameState): GameState {
  let s = state;

  for (const [factionId, faction] of s.factions) {
    if (!faction.alive) continue;

    // Step 5: Eliminate factions with 0 cities
    const factionCities = getFactionCities(s, factionId);
    if (factionCities.length === 0) {
      s = updateFaction(s, factionId, { alive: false });
      s = addLogEntry(
        s,
        `${faction.name} has been eliminated!`,
        "economy",
        [factionId],
      );
      continue;
    }

    // Step 1: Territory income
    const income = calculateIncome(s, factionId);

    // Step 2: Food consumption
    const upkeep = calculateUpkeep(s, factionId);

    const currentResources = faction.resources;
    const newResources: Resources = {
      gold: currentResources.gold + income.gold,
      food: currentResources.food + income.food - upkeep.food,
      wood: currentResources.wood + income.wood,
      iron: currentResources.iron + income.iron,
    };

    s = updateFaction(s, factionId, { resources: newResources });

    // Step 3: Starvation - if food goes below 0, troops desert
    if (newResources.food < 0) {
      s = applyStarvation(s, factionId);
      // Clamp food to 0 after starvation
      const starveFaction = s.factions.get(factionId)!;
      s = updateFaction(s, factionId, {
        resources: { ...starveFaction.resources, food: 0 },
      });
      s = addLogEntry(
        s,
        `${faction.name} is starving! Troops are deserting.`,
        "economy",
        [factionId],
      );
    }

    // Step 4: Process city training queues
    s = processTrainingQueues(s, factionId);
  }

  return s;
}

/**
 * Apply starvation: 10% of all troops desert across all armies and garrisons.
 */
function applyStarvation(state: GameState, factionId: FactionId): GameState {
  let s = state;

  // Desert from armies
  for (const army of getFactionArmies(s, factionId)) {
    const deserted = applyDesertionToTroops(army.troops, STARVATION_DESERTION_RATE);
    const newArmies = new Map(s.armies);
    newArmies.set(army.id, { ...army, troops: deserted });
    s = { ...s, armies: newArmies };
  }

  // Desert from city garrisons
  for (const city of getFactionCities(s, factionId)) {
    const deserted = applyDesertionToTroops(city.garrison, STARVATION_DESERTION_RATE);
    s = updateCity(s, city.id, { garrison: deserted });
  }

  return s;
}

/**
 * Process training queues for all cities of a faction.
 * Decrement ticksRemaining; when done, add troops to garrison.
 */
function processTrainingQueues(
  state: GameState,
  factionId: FactionId,
): GameState {
  let s = state;

  for (const city of getFactionCities(s, factionId)) {
    if (city.trainingQueue === null) continue;

    const queue = city.trainingQueue;
    const newTicksRemaining = queue.ticksRemaining - 1;

    if (newTicksRemaining <= 0) {
      // Training complete: add troops to garrison
      const troopType = queue.troopType;
      const newGarrison: Troops = {
        ...city.garrison,
        [troopType]: city.garrison[troopType] + queue.amount,
      };

      s = updateCity(s, city.id, {
        garrison: newGarrison,
        trainingQueue: null,
      });

      s = addLogEntry(
        s,
        `${city.name} finished training ${queue.amount} ${troopType}.`,
        "city",
        [factionId],
      );
    } else {
      // Still training: decrement ticks remaining
      s = updateCity(s, city.id, {
        trainingQueue: { ...queue, ticksRemaining: newTicksRemaining },
      });
    }
  }

  return s;
}
