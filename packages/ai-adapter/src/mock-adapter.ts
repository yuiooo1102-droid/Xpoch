import type {
  AIAdapter,
  TurnDecision,
  ArmyOrder,
  CityOrder,
  BuildOrder,
  DiplomacyOrder,
  GameState,
  FactionId,
  Army,
  City,
  General,
  HexCoord,
  BuildingType,
} from "@xpoch/shared";
import {
  hexKey,
  hexNeighbors,
  hexDistance,
  TECH_TREE,
  BUILDING_DEFS,
  TROOP_STATS,
} from "@xpoch/shared";

/**
 * Mock AI adapter for v3 (率土之滨 style).
 * Strategy:
 * - Deploy armies with available generals toward enemy cities
 * - Train infantry/cavalry in cities
 * - Build farms on owned plains, lumber mills on forests
 * - Research cheapest available tech
 */
export class MockAdapter implements AIAdapter {
  readonly providerId = "mock";

  async decideActions(
    state: GameState,
    factionId: FactionId,
  ): Promise<TurnDecision> {
    const faction = state.factions.get(factionId)!;
    const ownArmies = getArmiesForFaction(state, factionId);
    const ownCities = getCitiesForFaction(state, factionId);
    const ownGenerals = getGeneralsForFaction(state, factionId);

    const armyOrders = buildArmyOrders(state, factionId, ownArmies);
    const cityOrders = buildCityOrders(state, factionId, ownCities);
    const buildOrders = buildBuildOrders(state, factionId);
    const research = pickResearch(faction.techs);
    const diplomacy: readonly DiplomacyOrder[] = [];

    return {
      factionId,
      armies: armyOrders,
      cities: cityOrders,
      build: buildOrders,
      research,
      diplomacy,
    };
  }
}

// --- Army Orders ---

function buildArmyOrders(
  state: GameState,
  factionId: FactionId,
  armies: readonly Army[],
): readonly ArmyOrder[] {
  const enemyCities = [...state.cities.values()].filter(
    (c) => c.factionId !== factionId,
  );

  if (enemyCities.length === 0) {
    return armies.map((army) => ({
      generalId: army.generalId,
      action: "idle" as const,
    }));
  }

  return armies.map((army) => {
    const nearest = findNearestEnemyCity(army.coord, enemyCities);
    if (!nearest) {
      return { generalId: army.generalId, action: "idle" as const };
    }

    const dist = hexDistance(army.coord, nearest.coord);
    if (dist <= 1) {
      return {
        generalId: army.generalId,
        action: "attack" as const,
        target: nearest.coord,
      };
    }

    return {
      generalId: army.generalId,
      action: "march" as const,
      target: nearest.coord,
    };
  });
}

function findNearestEnemyCity(
  coord: HexCoord,
  enemyCities: readonly City[],
): City | null {
  if (enemyCities.length === 0) return null;

  let best = enemyCities[0];
  let bestDist = hexDistance(coord, best.coord);

  for (let i = 1; i < enemyCities.length; i++) {
    const d = hexDistance(coord, enemyCities[i].coord);
    if (d < bestDist) {
      bestDist = d;
      best = enemyCities[i];
    }
  }

  return best;
}

// --- City Orders ---

function buildCityOrders(
  state: GameState,
  factionId: FactionId,
  cities: readonly City[],
): readonly CityOrder[] {
  return cities.map((city) => {
    // If already training, idle
    if (city.trainingQueue) {
      return { cityId: city.id, action: "idle" as const };
    }

    // Alternate between infantry and cavalry
    const faction = state.factions.get(factionId)!;
    const totalArmyTroops = [...state.armies.values()]
      .filter((a) => a.factionId === factionId)
      .reduce(
        (sum, a) => sum + a.troops.infantry + a.troops.cavalry + a.troops.archer,
        0,
      );

    // Train infantry if garrison is low, else cavalry
    const garrisonTotal =
      city.garrison.infantry + city.garrison.cavalry + city.garrison.archer;

    if (garrisonTotal < 200) {
      return {
        cityId: city.id,
        action: "train" as const,
        troopType: "infantry" as const,
        amount: 100,
      };
    }

    return {
      cityId: city.id,
      action: "train" as const,
      troopType: "cavalry" as const,
      amount: 100,
    };
  });
}

// --- Build Orders ---

function buildBuildOrders(
  state: GameState,
  factionId: FactionId,
): readonly BuildOrder[] {
  const orders: BuildOrder[] = [];
  const faction = state.factions.get(factionId)!;

  // Find owned tiles without buildings
  for (const tile of state.tiles.values()) {
    if (tile.owner !== factionId) continue;
    if (tile.building !== null) continue;
    if (tile.cityId !== null) continue; // skip city centers

    let buildingType: BuildingType | null = null;

    if (tile.terrain === "plains") {
      buildingType = "farm";
    } else if (tile.terrain === "forest") {
      buildingType = "lumber_mill";
    }

    if (buildingType) {
      const def = BUILDING_DEFS[buildingType];
      // Check if we can afford it
      if (
        faction.resources.gold >= def.cost.gold &&
        faction.resources.food >= def.cost.food &&
        faction.resources.wood >= def.cost.wood &&
        faction.resources.iron >= def.cost.iron
      ) {
        orders.push({ hex: tile.coord, building: buildingType });
        // Only build one per tick to conserve resources
        break;
      }
    }
  }

  return orders;
}

// --- Research ---

function pickResearch(researchedTechs: readonly string[]): string | null {
  const available = TECH_TREE.filter((t) => {
    if (researchedTechs.includes(t.id)) return false;
    return t.prerequisites.every((p) => researchedTechs.includes(p));
  });

  if (available.length === 0) return null;

  // Pick cheapest by total resource cost
  return available.reduce((a, b) => {
    const aCost = a.cost.gold + a.cost.food + a.cost.wood + a.cost.iron;
    const bCost = b.cost.gold + b.cost.food + b.cost.wood + b.cost.iron;
    return aCost <= bCost ? a : b;
  }).id;
}

// --- Utility ---

function getArmiesForFaction(state: GameState, factionId: FactionId): Army[] {
  return [...state.armies.values()].filter((a) => a.factionId === factionId);
}

function getCitiesForFaction(state: GameState, factionId: FactionId): City[] {
  return [...state.cities.values()].filter((c) => c.factionId === factionId);
}

function getGeneralsForFaction(state: GameState, factionId: FactionId): General[] {
  return [...state.generals.values()].filter((g) => g.factionId === factionId);
}
