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
import {
  hexKey,
  hexNeighbors,
  hexDistance,
  UNIT_STATS,
  TECH_TREE,
  BUILDING_STATS,
  CAPITAL_DEFENSE_BONUS,
  CITY_DEFENSE_BONUS,
  WALLS_DEFENSE_BONUS,
} from "@xpoch/shared";

/**
 * Mock AI that groups forces at a rally hex adjacent to the target,
 * attacks only with sufficient strength advantage, and builds
 * diverse improvements.
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

/** Minimum strength ratio (own / enemy) to launch an attack */
const ATTACK_STRENGTH_RATIO = 1.0;

function buildMilitaryOrders(
  state: GameState,
  factionId: FactionId,
  units: readonly Unit[],
): readonly MilitaryOrder[] {
  const enemyCities = [...state.cities.values()].filter(
    (c) => c.factionId !== factionId,
  );
  const ownCities = getCitiesForFaction(state, factionId);

  // Pick the nearest enemy city as the primary target
  const targetCity = pickTargetCity(ownCities, enemyCities);

  // Pick a rally hex: a walkable, non-enemy-occupied hex adjacent to the target city
  const rallyHex = targetCity
    ? pickRallyHex(state, factionId, targetCity.coord)
    : null;

  // Estimate enemy defense strength at the target
  const targetDefenseStrength = targetCity
    ? estimateDefenseStrength(state, factionId, targetCity)
    : Infinity;

  // Track which hexes already have an attack order this tick
  const attackedHexes = new Set<string>();

  return units.map((unit) =>
    decideMilitaryOrder(
      state,
      factionId,
      unit,
      rallyHex,
      targetCity,
      targetDefenseStrength,
      attackedHexes,
    ),
  );
}

function pickTargetCity(
  ownCities: readonly City[],
  enemyCities: readonly City[],
): City | null {
  if (enemyCities.length === 0 || ownCities.length === 0) return null;

  let bestTarget: City | null = null;
  let bestDist = Infinity;

  for (const ec of enemyCities) {
    for (const oc of ownCities) {
      const d = hexDistance(ec.coord, oc.coord);
      if (d < bestDist) {
        bestDist = d;
        bestTarget = ec;
      }
    }
  }

  return bestTarget;
}

/**
 * Pick a rally hex adjacent to the target city that is walkable
 * and not occupied by enemy units. Prefer hexes that are closest
 * to our own cities (shortest approach distance).
 */
function pickRallyHex(
  state: GameState,
  factionId: FactionId,
  targetCoord: HexCoord,
): HexCoord | null {
  const ownCities = getCitiesForFaction(state, factionId);
  const candidates = hexNeighbors(targetCoord).filter((n) => {
    const tile = state.tiles.get(hexKey(n));
    if (!tile || tile.terrain === "water") return false;
    return true;
  });

  if (candidates.length === 0) return null;

  // Pick the one closest to our nearest city (shortest march)
  return candidates.reduce((best, c) => {
    const cDist = ownCities.reduce(
      (min, oc) => Math.min(min, hexDistance(c, oc.coord)),
      Infinity,
    );
    const bestDist = ownCities.reduce(
      (min, oc) => Math.min(min, hexDistance(best, oc.coord)),
      Infinity,
    );
    return cDist < bestDist ? c : best;
  });
}

function estimateDefenseStrength(
  state: GameState,
  factionId: FactionId,
  targetCity: City,
): number {
  // Enemy units at and around the city
  let strength = 0;
  const cityKey = hexKey(targetCity.coord);
  for (const unit of state.units.values()) {
    if (unit.factionId !== factionId && hexKey(unit.coord) === cityKey) {
      strength += unit.strength;
    }
  }

  // City defense bonuses
  strength += targetCity.isCapital ? CAPITAL_DEFENSE_BONUS : CITY_DEFENSE_BONUS;
  if (targetCity.hasWalls) {
    strength += WALLS_DEFENSE_BONUS;
  }

  return strength;
}

function decideMilitaryOrder(
  state: GameState,
  factionId: FactionId,
  unit: Unit,
  rallyHex: HexCoord | null,
  targetCity: City | null,
  targetDefenseStrength: number,
  attackedHexes: Set<string>,
): MilitaryOrder {
  if (unit.movement <= 0) {
    return { unitId: unit.id, action: "fortify" };
  }

  // Scouts explore
  if (unit.type === "scout") {
    return decideScoutOrder(state, factionId, unit);
  }

  // If adjacent to the target city, check if we should attack
  if (targetCity) {
    const distToTarget = hexDistance(unit.coord, targetCity.coord);
    if (distToTarget === 1) {
      const friendlyStrength = getStrengthAt(state, unit.coord, factionId);
      if (friendlyStrength >= targetDefenseStrength * ATTACK_STRENGTH_RATIO) {
        const targetHexKey = hexKey(targetCity.coord);
        if (!attackedHexes.has(targetHexKey)) {
          attackedHexes.add(targetHexKey);
          return { unitId: unit.id, action: "attack", to: targetCity.coord };
        }
        // Already issued attack from this hex; fortify to be pulled into combat
        return { unitId: unit.id, action: "fortify" };
      }
      // Not strong enough yet -- stay put and wait for reinforcements
      return { unitId: unit.id, action: "fortify" };
    }
  }

  // Check for adjacent non-city enemies (field battles)
  const adjacentEnemyHex = findAdjacentEnemy(state, factionId, unit.coord);
  if (adjacentEnemyHex) {
    const friendlyStrength = getStrengthAt(state, unit.coord, factionId);
    const enemyStrength = getEnemyStrengthAt(state, adjacentEnemyHex, factionId);

    if (friendlyStrength >= enemyStrength) {
      const hexKeyStr = hexKey(adjacentEnemyHex);
      if (!attackedHexes.has(hexKeyStr)) {
        attackedHexes.add(hexKeyStr);
        return { unitId: unit.id, action: "attack", to: adjacentEnemyHex };
      }
      return { unitId: unit.id, action: "fortify" };
    }
    // Outnumbered in field -- retreat toward rally point or fortify
  }

  // Move toward rally hex (or target city if no rally hex)
  const destination = rallyHex ?? (targetCity ? targetCity.coord : null);
  if (destination) {
    const step = findSafeStepToward(state, factionId, unit.coord, destination);
    if (step) {
      return { unitId: unit.id, action: "move", to: step };
    }
  }

  return { unitId: unit.id, action: "fortify" };
}

function decideScoutOrder(
  state: GameState,
  factionId: FactionId,
  unit: Unit,
): MilitaryOrder {
  const ownCities = [...state.cities.values()].filter(
    (c) => c.factionId === factionId,
  );

  const neighbors = hexNeighbors(unit.coord).filter((n) => {
    const tile = state.tiles.get(hexKey(n));
    if (!tile || tile.terrain === "water") return false;
    // Avoid hexes with enemy units
    const hasEnemy = [...state.units.values()].some(
      (u) => u.factionId !== factionId && hexKey(u.coord) === hexKey(n),
    );
    return !hasEnemy;
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
    const nbKey = hexKey(nb);
    const hasEnemy = [...state.units.values()].some(
      (u) => u.factionId !== factionId && hexKey(u.coord) === nbKey,
    );
    if (hasEnemy) return nb;
  }
  return null;
}

/**
 * Find a step toward the target that avoids hexes with enemy units.
 * This prevents the "move into enemy hex" validation error.
 */
function findSafeStepToward(
  state: GameState,
  factionId: FactionId,
  from: HexCoord,
  target: HexCoord,
): HexCoord | null {
  const candidates = hexNeighbors(from).filter((n) => {
    const tile = state.tiles.get(hexKey(n));
    if (!tile || tile.terrain === "water") return false;
    // Avoid hexes occupied by enemy units
    const nKey = hexKey(n);
    const hasEnemy = [...state.units.values()].some(
      (u) => u.factionId !== factionId && hexKey(u.coord) === nKey,
    );
    return !hasEnemy;
  });

  if (candidates.length === 0) return null;

  return candidates.reduce((best, c) =>
    hexDistance(c, target) < hexDistance(best, target) ? c : best,
  );
}

function getStrengthAt(
  state: GameState,
  coord: HexCoord,
  factionId: FactionId,
): number {
  const key = hexKey(coord);
  let strength = 0;
  for (const unit of state.units.values()) {
    if (hexKey(unit.coord) === key && unit.factionId === factionId) {
      strength += unit.strength;
    }
  }
  return strength;
}

function getEnemyStrengthAt(
  state: GameState,
  coord: HexCoord,
  factionId: FactionId,
): number {
  const key = hexKey(coord);
  let strength = 0;
  for (const unit of state.units.values()) {
    if (hexKey(unit.coord) === key && unit.factionId !== factionId) {
      strength += unit.strength;
    }
  }
  return strength;
}

// --- City Orders ---

/** Building priority list */
const BUILDING_PRIORITY: readonly {
  readonly type: keyof typeof BUILDING_STATS;
  readonly unique: boolean;
}[] = [
  { type: "barracks", unique: true },
  { type: "library", unique: true },
  { type: "granary", unique: true },
  { type: "workshop", unique: true },
  { type: "market", unique: true },
  { type: "city_walls", unique: true },
];

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
  const faction = state.factions.get(factionId)!;

  // If already building something, continue
  if (city.currentProject) {
    return { cityId: city.id, action: "idle" };
  }

  // Try to build buildings in priority order
  for (const entry of BUILDING_PRIORITY) {
    if (!canBuildBuilding(faction, entry.type)) continue;

    if (entry.unique) {
      const alreadyHas = [...state.tiles.values()].some(
        (t) => t.isCityOutskirt === city.id && t.building === entry.type,
      );
      if (alreadyHas) continue;
    }

    const buildHex = findBuildableHex(state, city.id, entry.type);
    if (buildHex) {
      return {
        cityId: city.id,
        action: "build",
        target: entry.type,
        hex: buildHex,
      };
    }
  }

  // Train military units if gold allows
  if (gold >= UNIT_STATS.infantry.cost) {
    const ownUnits = [...state.units.values()].filter(
      (u) => u.factionId === factionId,
    );
    const infantryCount = ownUnits.filter((u) => u.type === "infantry").length;
    const cavalryCount = ownUnits.filter((u) => u.type === "cavalry").length;
    const artilleryCount = ownUnits.filter((u) => u.type === "artillery").length;

    // Build a balanced army: 2 infantry : 1 cavalry : 1 artillery
    let unitType: string = "infantry";
    if (cavalryCount * 2 < infantryCount && gold >= UNIT_STATS.cavalry.cost) {
      unitType = "cavalry";
    } else if (artilleryCount * 2 < infantryCount && gold >= UNIT_STATS.artillery.cost) {
      unitType = "artillery";
    }

    return { cityId: city.id, action: "train", target: unitType };
  }

  return { cityId: city.id, action: "idle" };
}

function canBuildBuilding(
  faction: { readonly techs: readonly string[] },
  buildingType: keyof typeof BUILDING_STATS,
): boolean {
  const stats = BUILDING_STATS[buildingType];
  if (stats.requiresTech === null) return true;
  return faction.techs.includes(stats.requiresTech);
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

const PRIORITY_TECHS = [
  "bronze_working",
  "mining",
  "pottery",
  "animal_husbandry",
  "currency",
  "masonry",
];

function pickResearch(researchedTechs: readonly string[]): string | null {
  const available = TECH_TREE.filter((t) => {
    if (researchedTechs.includes(t.id)) return false;
    return t.prerequisites.every((p) => researchedTechs.includes(p));
  });

  if (available.length === 0) return null;

  const prioritized = available.find((t) => PRIORITY_TECHS.includes(t.id));
  if (prioritized) return prioritized.id;

  return available.reduce((a, b) => (a.cost <= b.cost ? a : b)).id;
}

// --- Utility ---

function getUnitsForFaction(state: GameState, factionId: FactionId): Unit[] {
  return [...state.units.values()].filter((u) => u.factionId === factionId);
}

function getCitiesForFaction(state: GameState, factionId: FactionId): City[] {
  return [...state.cities.values()].filter((c) => c.factionId === factionId);
}
