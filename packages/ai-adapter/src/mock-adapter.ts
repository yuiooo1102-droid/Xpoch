import type {
  AIAdapter,
  TurnDecision,
  MilitaryOrder,
  CityOrder,
  GameState,
  FactionId,
  Unit,
  City,
  HexCoord,
} from "@xpoch/shared";
import { hexKey, hexNeighbors, hexDistance, UNIT_STATS, TECH_TREE, BUILDING_STATS } from "@xpoch/shared";

/**
 * Aggressive mock AI that trains units, builds improvements,
 * researches tech, and moves units toward enemy cities.
 */
export class MockAdapter implements AIAdapter {
  readonly providerId = "mock";

  async decideActions(
    state: GameState,
    factionId: FactionId,
  ): Promise<TurnDecision> {
    const faction = state.factions.get(factionId)!;
    const ownUnits = getUnitsForFaction(state, factionId);
    const ownCities = getCitiesForFaction(state, factionId);

    const militaryOrders = buildMilitaryOrders(state, factionId, ownUnits);
    const cityOrders = buildCityOrders(state, factionId, ownCities, faction.gold);
    const research = pickResearch(faction.techs);
    const diplomacy: TurnDecision["diplomacy"] = [];

    return {
      factionId,
      military: militaryOrders,
      cities: cityOrders,
      research,
      diplomacy,
    };
  }
}

// --- Military ---

function buildMilitaryOrders(
  state: GameState,
  factionId: FactionId,
  units: readonly Unit[],
): readonly MilitaryOrder[] {
  const enemyCities = [...state.cities.values()].filter(
    (c) => c.factionId !== factionId,
  );

  return units.map((unit) =>
    decideMilitaryOrder(state, factionId, unit, enemyCities),
  );
}

function decideMilitaryOrder(
  state: GameState,
  factionId: FactionId,
  unit: Unit,
  enemyCities: readonly City[],
): MilitaryOrder {
  if (unit.movement <= 0) {
    return { unitId: unit.id, action: "fortify" };
  }

  // Scouts explore: move toward unexplored areas (away from own cities)
  if (unit.type === "scout") {
    return decideScoutOrder(state, factionId, unit);
  }

  // Check for adjacent enemies to attack
  const adjacentEnemy = findAdjacentEnemy(state, factionId, unit.coord);
  if (adjacentEnemy) {
    return { unitId: unit.id, action: "attack", to: adjacentEnemy };
  }

  // Move toward nearest enemy city
  if (enemyCities.length > 0) {
    const nearest = findNearest(unit.coord, enemyCities.map((c) => c.coord));
    if (nearest) {
      const stepToward = findStepToward(state, unit.coord, nearest);
      if (stepToward) {
        return { unitId: unit.id, action: "move", to: stepToward };
      }
    }
  }

  return { unitId: unit.id, action: "fortify" };
}

function decideScoutOrder(
  state: GameState,
  factionId: FactionId,
  unit: Unit,
): MilitaryOrder {
  // Move away from own cities toward map edges for exploration
  const ownCities = [...state.cities.values()].filter(
    (c) => c.factionId === factionId,
  );

  const neighbors = hexNeighbors(unit.coord).filter((n) => {
    const tile = state.tiles.get(hexKey(n));
    return tile && tile.terrain !== "water";
  });

  if (neighbors.length === 0) {
    return { unitId: unit.id, action: "fortify" };
  }

  // Prefer neighbor farthest from own cities
  const best = neighbors.reduce((a, b) => {
    const aDist = ownCities.reduce((sum, c) => sum + hexDistance(a, c.coord), 0);
    const bDist = ownCities.reduce((sum, c) => sum + hexDistance(b, c.coord), 0);
    return aDist > bDist ? a : b;
  });

  return { unitId: unit.id, action: "move", to: best };
}

function findAdjacentEnemy(
  state: GameState,
  factionId: FactionId,
  coord: HexCoord,
): HexCoord | null {
  for (const nb of hexNeighbors(coord)) {
    const hasEnemy = [...state.units.values()].some(
      (u) => u.factionId !== factionId && hexKey(u.coord) === hexKey(nb),
    );
    if (hasEnemy) return nb;

    // Also attack enemy cities
    const tile = state.tiles.get(hexKey(nb));
    if (tile?.cityId) {
      const city = state.cities.get(tile.cityId);
      if (city && city.factionId !== factionId) return nb;
    }
  }
  return null;
}

function findNearest(
  from: HexCoord,
  targets: readonly HexCoord[],
): HexCoord | null {
  if (targets.length === 0) return null;

  return targets.reduce((closest, t) =>
    hexDistance(from, t) < hexDistance(from, closest) ? t : closest,
  );
}

function findStepToward(
  state: GameState,
  from: HexCoord,
  target: HexCoord,
): HexCoord | null {
  const candidates = hexNeighbors(from).filter((n) => {
    const tile = state.tiles.get(hexKey(n));
    return tile && tile.terrain !== "water";
  });

  if (candidates.length === 0) return null;

  return candidates.reduce((best, c) =>
    hexDistance(c, target) < hexDistance(best, target) ? c : best,
  );
}

// --- City Orders ---

function buildCityOrders(
  state: GameState,
  factionId: FactionId,
  cities: readonly City[],
  gold: number,
): readonly CityOrder[] {
  return cities.map((city) => decideCityOrder(state, factionId, city, gold));
}

function decideCityOrder(
  state: GameState,
  factionId: FactionId,
  city: City,
  gold: number,
): CityOrder {
  // If already building something, continue (or rush if affordable)
  if (city.currentProject) {
    return { cityId: city.id, action: "idle" };
  }

  // Check if city has barracks in outskirts
  const hasBarracks = [...state.tiles.values()].some(
    (t) => t.isCityOutskirt === city.id && t.building === "barracks",
  );

  // Build barracks first if missing
  if (!hasBarracks) {
    const buildHex = findBuildableHex(state, city.id, "barracks");
    if (buildHex) {
      return {
        cityId: city.id,
        action: "build",
        target: "barracks",
        hex: buildHex,
      };
    }
  }

  // Train military units if gold allows
  if (gold >= UNIT_STATS.infantry.cost) {
    // Alternate between infantry and cavalry
    const ownUnits = [...state.units.values()].filter(
      (u) => u.factionId === factionId,
    );
    const infantryCount = ownUnits.filter((u) => u.type === "infantry").length;
    const cavalryCount = ownUnits.filter((u) => u.type === "cavalry").length;

    const unitType = cavalryCount < infantryCount && gold >= UNIT_STATS.cavalry.cost
      ? "cavalry"
      : "infantry";

    return { cityId: city.id, action: "train", target: unitType };
  }

  return { cityId: city.id, action: "idle" };
}

function findBuildableHex(
  state: GameState,
  cityId: string,
  buildingType: string,
): HexCoord | null {
  const stats = BUILDING_STATS[buildingType as keyof typeof BUILDING_STATS];
  if (!stats) return null;

  for (const tile of state.tiles.values()) {
    if (tile.isCityOutskirt !== cityId) continue;
    if (tile.building) continue;

    // Check terrain compatibility
    if (stats.anyLand && tile.terrain !== "water") {
      return tile.coord;
    }
    if (stats.terrains.includes(tile.terrain)) {
      return tile.coord;
    }
  }

  return null;
}

// --- Research ---

function pickResearch(researchedTechs: readonly string[]): string | null {
  const available = TECH_TREE.filter((t) => {
    if (researchedTechs.includes(t.id)) return false;
    return t.prerequisites.every((p) => researchedTechs.includes(p));
  });

  if (available.length === 0) return null;

  // Pick cheapest
  return available.reduce((a, b) => (a.cost <= b.cost ? a : b)).id;
}

// --- Utility ---

function getUnitsForFaction(state: GameState, factionId: FactionId): Unit[] {
  return [...state.units.values()].filter((u) => u.factionId === factionId);
}

function getCitiesForFaction(state: GameState, factionId: FactionId): City[] {
  return [...state.cities.values()].filter((c) => c.factionId === factionId);
}
