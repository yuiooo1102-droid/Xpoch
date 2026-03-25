import type { GameState, FactionId, Tile } from "@xpoch/shared";
import {
  TERRAIN_GOLD,
  BUILDING_STATS,
  FOOD_PER_UNIT,
  MAX_STORED_FOOD,
} from "@xpoch/shared";
import {
  updateFaction,
  addLogEntry,
  updateUnit,
  getFactionCities,
} from "./game-state";

// === Helpers ===

/**
 * Determine whether a tile is owned by a given faction.
 * A tile is "owned" if:
 *   - tile.owner === factionId, OR
 *   - tile.isCityOutskirt points to a city belonging to that faction, OR
 *   - tile.cityId points to a city belonging to that faction
 */
function isTileOwnedBy(state: GameState, tile: Tile, factionId: FactionId): boolean {
  if (tile.owner === factionId) return true;

  if (tile.isCityOutskirt !== null) {
    const city = state.cities.get(tile.isCityOutskirt);
    if (city !== undefined && city.factionId === factionId) return true;
  }

  if (tile.cityId !== null) {
    const city = state.cities.get(tile.cityId);
    if (city !== undefined && city.factionId === factionId) return true;
  }

  return false;
}

/**
 * Collect all tiles owned by a faction.
 */
function getOwnedTiles(state: GameState, factionId: FactionId): readonly Tile[] {
  const result: Tile[] = [];
  for (const tile of state.tiles.values()) {
    if (isTileOwnedBy(state, tile, factionId)) {
      result.push(tile);
    }
  }
  return result;
}

/**
 * Get IDs of all units belonging to a faction.
 */
function getFactionUnitIds(state: GameState, factionId: FactionId): readonly string[] {
  const ids: string[] = [];
  for (const unit of state.units.values()) {
    if (unit.factionId === factionId) {
      ids.push(unit.id);
    }
  }
  return ids;
}

function hasTech(state: GameState, factionId: FactionId, techId: string): boolean {
  const faction = state.factions.get(factionId);
  if (faction === undefined) return false;
  return faction.techs.includes(techId);
}

// === Public API ===

/**
 * Calculate total gold income for a faction this tick.
 * Sum of TERRAIN_GOLD for each owned tile + building gold bonuses.
 */
export function calculateGoldIncome(state: GameState, factionId: FactionId): number {
  const tiles = getOwnedTiles(state, factionId);

  let income = 0;
  for (const tile of tiles) {
    income += TERRAIN_GOLD[tile.terrain];
    if (tile.building !== null) {
      income += BUILDING_STATS[tile.building].goldBonus;
    }
  }

  return income;
}

/**
 * Calculate food balance (production - consumption) for a faction.
 * Food production comes from:
 *   - Plains tiles when faction has "agriculture" tech (+1 each)
 *   - Buildings with foodBonus (e.g. granary +2)
 * Consumption: each unit costs FOOD_PER_UNIT per tick.
 */
export function calculateFoodBalance(
  state: GameState,
  factionId: FactionId,
): { readonly produced: number; readonly consumed: number; readonly balance: number } {
  const tiles = getOwnedTiles(state, factionId);
  const hasAgriculture = hasTech(state, factionId, "agriculture");

  let produced = 0;
  for (const tile of tiles) {
    if (hasAgriculture && tile.terrain === "plains") {
      produced += 1;
    }
    if (tile.building !== null) {
      produced += BUILDING_STATS[tile.building].foodBonus;
    }
  }

  const unitIds = getFactionUnitIds(state, factionId);
  const consumed = unitIds.length * FOOD_PER_UNIT;

  return { produced, consumed, balance: produced - consumed };
}

/**
 * Calculate research points generated this tick for a faction.
 * From buildings with researchBonus (e.g. library +2).
 */
export function calculateResearch(state: GameState, factionId: FactionId): number {
  const tiles = getOwnedTiles(state, factionId);

  let research = 0;
  for (const tile of tiles) {
    if (tile.building !== null) {
      research += BUILDING_STATS[tile.building].researchBonus;
    }
  }

  return research;
}

/**
 * Process one tick of economy for all factions:
 * 1. Calculate gold income: sum of TERRAIN_GOLD for owned tiles + building gold bonuses
 * 2. Calculate food production: from plains (agriculture tech) + granary buildings
 * 3. Food consumption: each unit costs FOOD_PER_UNIT (1) food per tick
 * 4. Starvation: if food deficit, units lose 1 HP (strength) each
 * 5. Research income: from libraries + building research bonuses per city
 * 6. Eliminate factions with 0 cities
 */
export function processEconomy(state: GameState): GameState {
  let s = state;

  for (const [factionId, faction] of s.factions) {
    if (!faction.alive) continue;

    // Step 6: Eliminate factions with 0 cities
    const factionCities = getFactionCities(s, factionId);
    if (factionCities.length === 0) {
      s = updateFaction(s, factionId, { alive: false });
      s = addLogEntry(s, `${faction.name} has been eliminated!`, "economy", [factionId]);
      continue;
    }

    // Step 1: Gold income
    const goldIncome = calculateGoldIncome(s, factionId);

    // Steps 2 & 3: Food production and consumption
    const foodBalance = calculateFoodBalance(s, factionId);

    // Total available food = current reserves + production - consumption
    const available = faction.food + faction.storedFood + foodBalance.produced - foodBalance.consumed;

    let newFood: number;
    let newStoredFood: number;

    if (available >= 0) {
      if (available > MAX_STORED_FOOD) {
        newStoredFood = MAX_STORED_FOOD;
        newFood = available - MAX_STORED_FOOD;
      } else {
        newFood = available;
        newStoredFood = 0;
      }
    } else {
      newFood = 0;
      newStoredFood = 0;
    }

    s = updateFaction(s, factionId, {
      gold: faction.gold + goldIncome,
      food: newFood,
      storedFood: newStoredFood,
    });

    // Step 4: Starvation — if food deficit, units lose 1 HP each
    if (available < 0) {
      const deficit = Math.abs(available);
      const unitIds = getFactionUnitIds(s, factionId);
      const unitsToStarve = Math.min(deficit, unitIds.length);

      for (let i = 0; i < unitsToStarve; i++) {
        const unit = s.units.get(unitIds[i]);
        if (unit === undefined) continue;

        const newStrength = unit.strength - 1;
        if (newStrength <= 0) {
          const newUnits = new Map(s.units);
          newUnits.delete(unitIds[i]);
          s = { ...s, units: newUnits };
        } else {
          s = updateUnit(s, unitIds[i], { strength: newStrength });
        }
      }

      s = addLogEntry(
        s,
        `${faction.name} is starving! ${unitsToStarve} unit(s) affected.`,
        "economy",
        [factionId],
      );
    }

    // Step 5: Research income
    const researchIncome = calculateResearch(s, factionId);
    if (researchIncome > 0) {
      const currentFaction = s.factions.get(factionId)!;
      s = updateFaction(s, factionId, {
        research: currentFaction.research + researchIncome,
      });
    }
  }

  return s;
}
