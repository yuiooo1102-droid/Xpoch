import type {
  GameState,
  FactionId,
  TurnDecision,
  MilitaryOrder,
  CityOrder,
  DiplomacyOrder,
  HexCoord,
  Unit,
  DiplomaticStatus,
} from "@xpoch/shared";
import { hexKey, UNIT_STATS, BUILDING_STATS, RUSH_GOLD_MULTIPLIER, TERRAIN_DEFENSE_BONUS, CITY_DEFENSE_BONUS, CAPITAL_DEFENSE_BONUS, WALLS_DEFENSE_BONUS } from "@xpoch/shared";
import {
  updateFaction,
  addLogEntry,
  updateUnit,
  removeUnit,
  addUnit,
  getUnitsAt,
  getCityAt,
} from "./game-state";
import {
  validateMilitaryOrder,
  validateCityOrder,
  validateDiplomacyOrder,
} from "./action-validator";
import { resolveCombat } from "./combat-resolver";
import { researchTech } from "./tech-tree";

// === Main entry point ===

/**
 * Execute all actions in a TurnDecision for one faction.
 * Order: research → diplomacy → city orders → military orders
 */
export function executeTurnDecision(
  state: GameState,
  decision: TurnDecision,
): GameState {
  const { factionId } = decision;

  const faction = state.factions.get(factionId);
  if (!faction || !faction.alive) return state;

  let s = state;

  // 1. Research
  if (decision.research) {
    const researchResult = researchTech(s, factionId, decision.research);
    if (researchResult) {
      s = researchResult;
    }
  }

  // 2. Diplomacy
  for (const order of decision.diplomacy) {
    s = executeDiplomacyOrder(s, order, factionId);
  }

  // 3. City orders
  for (const order of decision.cities) {
    s = executeCityOrder(s, order, factionId);
  }

  // 4. Military orders
  for (const order of decision.military) {
    s = executeMilitaryOrder(s, order, factionId);
  }

  return s;
}

// === Military execution ===

function executeMilitaryOrder(
  state: GameState,
  order: MilitaryOrder,
  factionId: FactionId,
): GameState {
  const validation = validateMilitaryOrder(state, order, factionId);
  if (!validation.valid) {
    return addLogEntry(
      state,
      `[${factionId}] Invalid military order: ${validation.reason}`,
      "system",
      [factionId],
    );
  }

  switch (order.action) {
    case "move":
      return executeMoveOrAttack(state, order, factionId);
    case "attack":
      return executeMoveOrAttack(state, order, factionId);
    case "fortify":
      return executeFortify(state, order);
    case "disband":
      return executeDisband(state, order, factionId);
    default:
      return state;
  }
}

function executeMoveOrAttack(
  state: GameState,
  order: MilitaryOrder,
  factionId: FactionId,
): GameState {
  const unit = state.units.get(order.unitId);
  if (!unit || !order.to) return state;

  const targetKey = hexKey(order.to);

  // Check for enemy units at target
  const enemyUnits = getEnemyUnitsAt(state, order.to, factionId);

  if (enemyUnits.length > 0) {
    return executeAttackCombat(state, unit, order.to, factionId);
  }

  // Check for enemy city (undefended)
  const cityAtTarget = getCityAt(state, order.to);
  if (cityAtTarget && cityAtTarget.factionId !== factionId) {
    return executeCityCapture(state, unit, order.to, factionId);
  }

  // Simple move
  const s = updateUnit(state, order.unitId, { coord: order.to });
  return addLogEntry(
    s,
    `${factionId} moved ${unit.type} to ${targetKey}`,
    "combat",
    [factionId],
  );
}

function executeAttackCombat(
  state: GameState,
  attacker: Unit,
  target: HexCoord,
  factionId: FactionId,
): GameState {
  const targetKey = hexKey(target);
  const targetTile = state.tiles.get(targetKey);
  const terrainBonus = targetTile ? TERRAIN_DEFENSE_BONUS[targetTile.terrain] : 0;

  // Calculate city defense bonus
  const cityAtTarget = getCityAt(state, target);
  let cityBonus = 0;
  if (cityAtTarget && cityAtTarget.factionId !== factionId) {
    cityBonus = cityAtTarget.isCapital ? CAPITAL_DEFENSE_BONUS : CITY_DEFENSE_BONUS;
    if (cityAtTarget.hasWalls) {
      cityBonus += WALLS_DEFENSE_BONUS;
    }
  }

  const enemyUnits = getEnemyUnitsAt(state, target, factionId);

  const combatResult = resolveCombat(
    [attacker],
    enemyUnits,
    terrainBonus,
    cityBonus,
  );

  let s = state;

  // Remove dead attackers
  for (const dead of combatResult.attackerLosses) {
    s = removeUnit(s, dead.id);
  }

  // Remove dead defenders
  for (const dead of combatResult.defenderLosses) {
    s = removeUnit(s, dead.id);
  }

  if (combatResult.attackerWins) {
    // Move surviving attacker to target
    for (const survivor of combatResult.survivingAttackers) {
      s = updateUnit(s, survivor.id, { coord: target });
    }

    // Capture city if present
    if (cityAtTarget && cityAtTarget.factionId !== factionId) {
      s = captureCity(s, cityAtTarget.id, factionId);
    }

    s = addLogEntry(
      s,
      `${factionId} won battle at ${targetKey}`,
      "combat",
      [factionId, enemyUnits[0]?.factionId].filter(Boolean) as FactionId[],
    );
  } else {
    s = addLogEntry(
      s,
      `${factionId} lost battle at ${targetKey}`,
      "combat",
      [factionId, enemyUnits[0]?.factionId].filter(Boolean) as FactionId[],
    );
  }

  return s;
}

function executeCityCapture(
  state: GameState,
  unit: Unit,
  target: HexCoord,
  factionId: FactionId,
): GameState {
  const cityAtTarget = getCityAt(state, target);
  if (!cityAtTarget) return state;

  let s = updateUnit(state, unit.id, { coord: target });
  s = captureCity(s, cityAtTarget.id, factionId);

  return addLogEntry(
    s,
    `${factionId} captured ${cityAtTarget.name}`,
    "combat",
    [factionId, cityAtTarget.factionId],
  );
}

function captureCity(
  state: GameState,
  cityId: string,
  newOwner: FactionId,
): GameState {
  const city = state.cities.get(cityId);
  if (!city) return state;

  // Update city ownership
  const newCities = new Map(state.cities);
  newCities.set(cityId, {
    ...city,
    factionId: newOwner,
    isCapital: false,
    currentProject: null,
  });

  let s: GameState = { ...state, cities: newCities };

  // Update all outskirt tiles to reflect new ownership
  const newTiles = new Map(s.tiles);
  for (const [key, tile] of newTiles) {
    if (tile.isCityOutskirt === cityId || tile.cityId === cityId) {
      newTiles.set(key, { ...tile, owner: newOwner });
    }
  }

  return { ...s, tiles: newTiles };
}

function executeFortify(state: GameState, order: MilitaryOrder): GameState {
  // Fortifying restores some strength (simplified: set to max)
  const unit = state.units.get(order.unitId);
  if (!unit) return state;
  return updateUnit(state, order.unitId, { strength: unit.maxStrength });
}

function executeDisband(
  state: GameState,
  order: MilitaryOrder,
  factionId: FactionId,
): GameState {
  const unit = state.units.get(order.unitId);
  if (!unit) return state;

  const s = removeUnit(state, order.unitId);
  return addLogEntry(
    s,
    `${factionId} disbanded ${unit.type}`,
    "combat",
    [factionId],
  );
}

// === City execution ===

function executeCityOrder(
  state: GameState,
  order: CityOrder,
  factionId: FactionId,
): GameState {
  const validation = validateCityOrder(state, order, factionId);
  if (!validation.valid) {
    return addLogEntry(
      state,
      `[${factionId}] Invalid city order: ${validation.reason}`,
      "system",
      [factionId],
    );
  }

  switch (order.action) {
    case "train":
      return executeTrain(state, order, factionId);
    case "build":
      return executeBuild(state, order, factionId);
    case "rush":
      return executeRush(state, order, factionId);
    case "idle":
      return state;
    default:
      return state;
  }
}

function executeTrain(
  state: GameState,
  order: CityOrder,
  factionId: FactionId,
): GameState {
  const city = state.cities.get(order.cityId);
  if (!city || !order.target) return state;

  const unitType = order.target as Unit["type"];
  const stats = UNIT_STATS[unitType];
  if (!stats) return state;

  const faction = state.factions.get(factionId);
  if (!faction) return state;

  // Deduct gold and create unit at city
  let s = updateFaction(state, factionId, {
    gold: faction.gold - stats.cost,
  });

  const newUnit: Unit = {
    id: `${factionId}-unit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    factionId,
    type: unitType,
    coord: city.coord,
    strength: stats.strength,
    maxStrength: stats.strength,
    movement: stats.movement,
    maxMovement: stats.movement,
    upgraded: false,
  };

  s = addUnit(s, newUnit);
  s = addLogEntry(
    s,
    `${factionId} trained ${unitType} at ${city.name}`,
    "city",
    [factionId],
  );

  return s;
}

function executeBuild(
  state: GameState,
  order: CityOrder,
  factionId: FactionId,
): GameState {
  const city = state.cities.get(order.cityId);
  if (!city || !order.target) return state;

  // Start a production project using BUILDING_STATS
  const bStats = BUILDING_STATS[order.target as keyof typeof BUILDING_STATS];
  const cost = bStats?.cost ?? 10;

  const newCities = new Map(state.cities);
  newCities.set(order.cityId, {
    ...city,
    currentProject: {
      type: "building",
      target: order.target,
      invested: 0,
      cost,
    },
  });

  const s: GameState = { ...state, cities: newCities };
  return addLogEntry(
    s,
    `${factionId} started building ${order.target} at ${city.name}`,
    "city",
    [factionId],
  );
}

function executeRush(
  state: GameState,
  order: CityOrder,
  factionId: FactionId,
): GameState {
  const city = state.cities.get(order.cityId);
  if (!city || !city.currentProject) return state;

  const faction = state.factions.get(factionId);
  if (!faction) return state;

  const remaining = city.currentProject.cost - city.currentProject.invested;
  const rushCost = remaining * RUSH_GOLD_MULTIPLIER;

  let s = updateFaction(state, factionId, {
    gold: faction.gold - rushCost,
  });

  // Complete the project
  const newCities = new Map(s.cities);
  newCities.set(order.cityId, {
    ...city,
    currentProject: null,
    production: 0,
  });

  s = { ...s, cities: newCities };
  s = addLogEntry(
    s,
    `${factionId} rush-completed ${city.currentProject.target} at ${city.name}`,
    "city",
    [factionId],
  );

  return s;
}

// === Diplomacy execution ===

function executeDiplomacyOrder(
  state: GameState,
  order: DiplomacyOrder,
  factionId: FactionId,
): GameState {
  const validation = validateDiplomacyOrder(state, order, factionId);
  if (!validation.valid) {
    return addLogEntry(
      state,
      `[${factionId}] Invalid diplomacy order: ${validation.reason}`,
      "system",
      [factionId],
    );
  }

  const key = diplomaticKey(factionId, order.targetFactionId);

  switch (order.action) {
    case "declare_war":
      return setDiplomacy(state, key, "war", factionId, order.targetFactionId,
        `${factionId} declared WAR on ${order.targetFactionId}`);

    case "propose_alliance":
      return setDiplomacy(state, key, "allied", factionId, order.targetFactionId,
        `${factionId} formed ALLIANCE with ${order.targetFactionId}`);

    case "break_alliance":
      return setDiplomacy(state, key, "neutral", factionId, order.targetFactionId,
        `${factionId} broke alliance with ${order.targetFactionId}`);

    case "offer_peace":
      return setDiplomacy(state, key, "peace", factionId, order.targetFactionId,
        `${factionId} offered PEACE to ${order.targetFactionId}`);

    case "send_gold":
      return executeSendGold(state, factionId, order.targetFactionId, order.amount ?? 0);

    case "demand_tribute":
      return addLogEntry(
        state,
        `${factionId} demanded tribute from ${order.targetFactionId}`,
        "diplomacy",
        [factionId, order.targetFactionId],
      );

    default:
      return state;
  }
}

function diplomaticKey(a: FactionId, b: FactionId): string {
  return [a, b].sort().join(":");
}

function setDiplomacy(
  state: GameState,
  key: string,
  status: DiplomaticStatus,
  factionId: FactionId,
  targetId: FactionId,
  message: string,
): GameState {
  const newRelations = new Map(state.diplomacy.relations);
  newRelations.set(key, status);

  const s: GameState = { ...state, diplomacy: { relations: newRelations } };
  return addLogEntry(s, message, "diplomacy", [factionId, targetId]);
}

function executeSendGold(
  state: GameState,
  factionId: FactionId,
  targetId: FactionId,
  amount: number,
): GameState {
  const sender = state.factions.get(factionId);
  const receiver = state.factions.get(targetId);
  if (!sender || !receiver) return state;

  let s = updateFaction(state, factionId, { gold: sender.gold - amount });
  s = updateFaction(s, targetId, { gold: receiver.gold + amount });
  s = addLogEntry(
    s,
    `${factionId} sent ${amount} gold to ${targetId}`,
    "diplomacy",
    [factionId, targetId],
  );

  return s;
}

// === Helpers ===

function getEnemyUnitsAt(
  state: GameState,
  coord: HexCoord,
  factionId: FactionId,
): Unit[] {
  const key = hexKey(coord);
  const results: Unit[] = [];
  for (const unit of state.units.values()) {
    if (hexKey(unit.coord) === key && unit.factionId !== factionId) {
      results.push(unit);
    }
  }
  return results;
}
