import type {
  GameState,
  FactionId,
  TurnDecision,
  ArmyOrder,
  CityOrder,
  BuildOrder,
  DiplomacyOrder,
  HexCoord,
  DiplomaticStatus,
  Resources,
  Troops,
  TroopType,
} from "@xpoch/shared";
import {
  hexKey,
  hexDistance,
  hexNeighbors,
  TROOP_STATS,
  BUILDING_DEFS,
  CITY_UPGRADE_COST,
  WALL_UPGRADE_COST,
  MAX_CITY_LEVEL,
  MAX_WALLS,
  TERRAIN_DEFENSE,
  CITY_DEFENSE,
  CAPITAL_DEFENSE,
  WALL_DEFENSE_PER_LEVEL,
  GENERAL_POOL,
  TERRAIN_MOVEMENT_COST,
} from "@xpoch/shared";
import {
  updateFaction,
  addLogEntry,
  addArmy,
  updateArmy,
  removeArmy,
  updateCity,
  setTile,
  getFactionCities,
  getCityAt,
  nextArmyId,
} from "./game-state";
import {
  validateArmyOrder,
  validateCityOrder,
  validateBuildOrder,
  validateDiplomacyOrder,
} from "./action-validator";
import { researchTech } from "./tech-tree";
import { resolveBattle } from "./combat-resolver";

// === Main entry point ===

/**
 * Execute all actions in a TurnDecision for one faction.
 * Order: research -> diplomacy -> build orders -> city orders -> army orders
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

  // 3. Build orders
  for (const order of decision.build) {
    s = executeBuildOrder(s, order, factionId);
  }

  // 4. City orders
  for (const order of decision.cities) {
    s = executeCityOrder(s, order, factionId);
  }

  // 5. Army orders
  for (const order of decision.armies) {
    s = executeArmyOrder(s, order, factionId);
  }

  return s;
}

// === Army execution ===

function executeArmyOrder(
  state: GameState,
  order: ArmyOrder,
  factionId: FactionId,
): GameState {
  const validation = validateArmyOrder(state, order, factionId);
  if (!validation.valid) {
    return addLogEntry(
      state,
      `[${factionId}] Invalid army order: ${validation.reason}`,
      "system",
      [factionId],
    );
  }

  const army = [...state.armies.values()].find(
    (a) => a.generalId === order.generalId && a.factionId === factionId,
  );

  switch (order.action) {
    case "march":
      return executeMarch(state, army!, order);

    case "attack":
      return executeAttack(state, army!, order, factionId);

    case "retreat":
      return executeRetreat(state, army!, factionId);

    case "garrison":
      return executeGarrison(state, army!, factionId);

    case "idle":
      return state;

    default:
      return state;
  }
}

function executeMarch(
  state: GameState,
  army: { readonly id: string; readonly coord: HexCoord },
  order: ArmyOrder,
): GameState {
  if (!order.target) return state;

  // Set army marching toward target
  let s = updateArmy(state, army.id, {
    target: order.target,
    state: "marching",
  });

  // Move one step toward target (simplified: find best neighbor)
  const currentArmy = s.armies.get(army.id)!;
  const step = findStepToward(s, currentArmy.coord, order.target);
  if (step) {
    s = updateArmy(s, army.id, { coord: step });
  }

  return s;
}

function executeAttack(
  state: GameState,
  army: { readonly id: string; readonly generalId: string; readonly factionId: string; readonly troops: Troops; readonly coord: HexCoord },
  order: ArmyOrder,
  factionId: FactionId,
): GameState {
  if (!order.target) return state;

  const targetKey = hexKey(order.target);
  const targetTile = state.tiles.get(targetKey);
  const terrainDefense = targetTile ? TERRAIN_DEFENSE[targetTile.terrain] : 0;

  // Find attacker general def
  const attackerGeneral = state.generals.get(army.generalId);
  const attackerGenDef = attackerGeneral
    ? GENERAL_POOL.find((g) => g.id === attackerGeneral.defId) ?? null
    : null;

  // Find enemy armies at target
  const enemyArmies = [...state.armies.values()].filter(
    (a) => hexKey(a.coord) === targetKey && a.factionId !== factionId,
  );

  // Find enemy city at target
  const cityAtTarget = getCityAt(state, order.target);
  const enemyCityDefense =
    cityAtTarget && cityAtTarget.factionId !== factionId
      ? (cityAtTarget.isCapital ? CAPITAL_DEFENSE : CITY_DEFENSE) +
        cityAtTarget.walls * WALL_DEFENSE_PER_LEVEL
      : 0;

  // Combine all defender troops
  let defenderTroops: Troops = { infantry: 0, cavalry: 0, archer: 0 };
  let defenderGeneralDef = null;

  for (const enemyArmy of enemyArmies) {
    defenderTroops = {
      infantry: defenderTroops.infantry + enemyArmy.troops.infantry,
      cavalry: defenderTroops.cavalry + enemyArmy.troops.cavalry,
      archer: defenderTroops.archer + enemyArmy.troops.archer,
    };
    // Use first enemy general
    if (!defenderGeneralDef) {
      const gen = state.generals.get(enemyArmy.generalId);
      defenderGeneralDef = gen
        ? GENERAL_POOL.find((g) => g.id === gen.defId) ?? null
        : null;
    }
  }

  // Add city garrison to defenders
  const garrison: Troops | undefined =
    cityAtTarget && cityAtTarget.factionId !== factionId
      ? cityAtTarget.garrison
      : undefined;

  const battleResult = resolveBattle(
    { troops: army.troops, general: attackerGenDef },
    { troops: defenderTroops, general: defenderGeneralDef, garrison },
    terrainDefense,
    enemyCityDefense,
  );

  let s = state;

  // Update attacker army
  s = updateArmy(s, army.id, {
    troops: battleResult.attackerRemaining,
    state: "battling",
  });

  // Update or remove defender armies
  for (const enemyArmy of enemyArmies) {
    // Distribute losses proportionally
    const enemyTotal = defenderTroops.infantry + defenderTroops.cavalry + defenderTroops.archer;
    if (enemyTotal === 0) continue;

    const ratio = {
      infantry: enemyArmy.troops.infantry / Math.max(1, defenderTroops.infantry || 1),
      cavalry: enemyArmy.troops.cavalry / Math.max(1, defenderTroops.cavalry || 1),
      archer: enemyArmy.troops.archer / Math.max(1, defenderTroops.archer || 1),
    };

    const remaining: Troops = {
      infantry: Math.max(0, Math.round(battleResult.defenderRemaining.infantry * (defenderTroops.infantry > 0 ? enemyArmy.troops.infantry / defenderTroops.infantry : 0))),
      cavalry: Math.max(0, Math.round(battleResult.defenderRemaining.cavalry * (defenderTroops.cavalry > 0 ? enemyArmy.troops.cavalry / defenderTroops.cavalry : 0))),
      archer: Math.max(0, Math.round(battleResult.defenderRemaining.archer * (defenderTroops.archer > 0 ? enemyArmy.troops.archer / defenderTroops.archer : 0))),
    };

    const total = remaining.infantry + remaining.cavalry + remaining.archer;
    if (total === 0) {
      s = removeArmy(s, enemyArmy.id);
    } else {
      s = updateArmy(s, enemyArmy.id, { troops: remaining });
    }
  }

  // Update city garrison if city was involved
  if (garrison && cityAtTarget && battleResult.attackerWins) {
    // Attacker wins: capture city
    s = captureCity(s, cityAtTarget.id, factionId);

    // Move attacker to target hex
    s = updateArmy(s, army.id, {
      coord: order.target,
      state: "idle",
      target: null,
    });

    s = addLogEntry(
      s,
      `${factionId} captured ${cityAtTarget.name}!`,
      "combat",
      [factionId, cityAtTarget.factionId],
    );
  } else if (garrison && cityAtTarget && !battleResult.attackerWins) {
    // Defender wins: update garrison
    const garrisonRemaining: Troops = {
      infantry: Math.max(0, battleResult.defenderRemaining.infantry - defenderTroops.infantry),
      cavalry: Math.max(0, battleResult.defenderRemaining.cavalry - defenderTroops.cavalry),
      archer: Math.max(0, battleResult.defenderRemaining.archer - defenderTroops.archer),
    };
    s = updateCity(s, cityAtTarget.id, {
      garrison: {
        infantry: Math.max(0, garrisonRemaining.infantry),
        cavalry: Math.max(0, garrisonRemaining.cavalry),
        archer: Math.max(0, garrisonRemaining.archer),
      },
    });

    s = addLogEntry(
      s,
      `${factionId} failed to capture ${cityAtTarget.name}.`,
      "combat",
      [factionId, cityAtTarget.factionId],
    );
  } else if (battleResult.attackerWins) {
    // Field battle won: attacker moves to target
    s = updateArmy(s, army.id, {
      coord: order.target,
      state: "idle",
      target: null,
    });

    s = addLogEntry(
      s,
      `${factionId} won battle at ${targetKey}`,
      "combat",
      [factionId, ...(enemyArmies.length > 0 ? [enemyArmies[0].factionId] : [])],
    );
  } else {
    s = addLogEntry(
      s,
      `${factionId} lost battle at ${targetKey}`,
      "combat",
      [factionId, ...(enemyArmies.length > 0 ? [enemyArmies[0].factionId] : [])],
    );
  }

  // Remove attacker army if no troops left
  const updatedAttacker = s.armies.get(army.id);
  if (updatedAttacker) {
    const totalRemaining =
      updatedAttacker.troops.infantry +
      updatedAttacker.troops.cavalry +
      updatedAttacker.troops.archer;
    if (totalRemaining === 0) {
      s = removeArmy(s, army.id);
    }
  }

  return s;
}

function executeRetreat(
  state: GameState,
  army: { readonly id: string; readonly coord: HexCoord; readonly factionId: string },
  factionId: FactionId,
): GameState {
  // Find nearest own city
  const ownCities = getFactionCities(state, factionId);
  if (ownCities.length === 0) return state;

  let nearestCity = ownCities[0];
  let nearestDist = hexDistance(army.coord, nearestCity.coord);

  for (const city of ownCities) {
    const dist = hexDistance(army.coord, city.coord);
    if (dist < nearestDist) {
      nearestDist = dist;
      nearestCity = city;
    }
  }

  const step = findStepToward(state, army.coord, nearestCity.coord);
  if (step) {
    return updateArmy(state, army.id, {
      coord: step,
      target: nearestCity.coord,
      state: "returning",
    });
  }

  return state;
}

function executeGarrison(
  state: GameState,
  army: { readonly id: string; readonly troops: Troops; readonly coord: HexCoord; readonly generalId: string },
  factionId: FactionId,
): GameState {
  // Find city at army location
  const city = getCityAt(state, army.coord);
  if (!city || city.factionId !== factionId) return state;

  // Merge army troops into garrison
  const newGarrison: Troops = {
    infantry: city.garrison.infantry + army.troops.infantry,
    cavalry: city.garrison.cavalry + army.troops.cavalry,
    archer: city.garrison.archer + army.troops.archer,
  };

  let s = updateCity(state, city.id, { garrison: newGarrison });

  // Remove the army (general becomes free)
  s = removeArmy(s, army.id);

  s = addLogEntry(
    s,
    `Army garrisoned at ${city.name}, freeing general.`,
    "city",
    [factionId],
  );

  return s;
}

function captureCity(
  state: GameState,
  cityId: string,
  newOwner: FactionId,
): GameState {
  const city = state.cities.get(cityId);
  if (!city) return state;

  const oldOwner = city.factionId;

  // Update city ownership, reset garrison and training
  let s = updateCity(state, cityId, {
    factionId: newOwner,
    isCapital: false,
    garrison: { infantry: 0, cavalry: 0, archer: 0 },
    trainingQueue: null,
  });

  // Update tile ownership for city center
  s = setTile(s, city.coord, { owner: newOwner });

  // Update surrounding tiles
  const neighbors = hexNeighbors(city.coord);
  for (const nb of neighbors) {
    const tile = s.tiles.get(hexKey(nb));
    if (tile && tile.owner === oldOwner) {
      s = setTile(s, nb, { owner: newOwner });
    }
  }

  // Update territory counts
  const newOwnerFaction = s.factions.get(newOwner);
  const oldOwnerFaction = s.factions.get(oldOwner);
  const capturedTiles = 1 + neighbors.filter((nb) => {
    const t = s.tiles.get(hexKey(nb));
    return t && t.owner === newOwner;
  }).length;

  if (newOwnerFaction) {
    s = updateFaction(s, newOwner, {
      territoryCount: newOwnerFaction.territoryCount + capturedTiles,
    });
  }
  if (oldOwnerFaction) {
    s = updateFaction(s, oldOwner, {
      territoryCount: Math.max(0, oldOwnerFaction.territoryCount - capturedTiles),
    });
  }

  return s;
}

// === City order execution ===

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
      return executeTrainTroops(state, order, factionId);

    case "upgrade_walls":
      return executeUpgradeWalls(state, order, factionId);

    case "upgrade_city":
      return executeUpgradeCity(state, order, factionId);

    case "deploy":
      return executeDeployArmy(state, order, factionId);

    case "idle":
      return state;

    default:
      return state;
  }
}

function executeTrainTroops(
  state: GameState,
  order: CityOrder,
  factionId: FactionId,
): GameState {
  const city = state.cities.get(order.cityId);
  if (!city || !order.troopType) return state;

  // Skip if already training
  if (city.trainingQueue !== null) return state;

  const stats = TROOP_STATS[order.troopType];
  const amount = order.amount ?? 100;
  const batchCount = amount / 100;

  const cost: Resources = {
    gold: stats.trainCost.gold * batchCount,
    food: stats.trainCost.food * batchCount,
    wood: stats.trainCost.wood * batchCount,
    iron: stats.trainCost.iron * batchCount,
  };

  // Deduct resources
  const faction = state.factions.get(factionId)!;
  let s = updateFaction(state, factionId, {
    resources: {
      gold: faction.resources.gold - cost.gold,
      food: faction.resources.food - cost.food,
      wood: faction.resources.wood - cost.wood,
      iron: faction.resources.iron - cost.iron,
    },
  });

  // Set training queue
  s = updateCity(s, order.cityId, {
    trainingQueue: {
      troopType: order.troopType,
      amount,
      ticksRemaining: Math.ceil(stats.trainTicks * batchCount),
    },
  });

  s = addLogEntry(
    s,
    `${city.name} started training ${amount} ${order.troopType}.`,
    "city",
    [factionId],
  );

  return s;
}

function executeUpgradeWalls(
  state: GameState,
  order: CityOrder,
  factionId: FactionId,
): GameState {
  const city = state.cities.get(order.cityId)!;
  const faction = state.factions.get(factionId)!;

  let s = updateFaction(state, factionId, {
    resources: {
      gold: faction.resources.gold - WALL_UPGRADE_COST.gold,
      food: faction.resources.food - WALL_UPGRADE_COST.food,
      wood: faction.resources.wood - WALL_UPGRADE_COST.wood,
      iron: faction.resources.iron - WALL_UPGRADE_COST.iron,
    },
  });

  s = updateCity(s, order.cityId, { walls: city.walls + 1 });

  s = addLogEntry(
    s,
    `${city.name} upgraded walls to level ${city.walls + 1}.`,
    "city",
    [factionId],
  );

  return s;
}

function executeUpgradeCity(
  state: GameState,
  order: CityOrder,
  factionId: FactionId,
): GameState {
  const city = state.cities.get(order.cityId)!;
  const faction = state.factions.get(factionId)!;

  let s = updateFaction(state, factionId, {
    resources: {
      gold: faction.resources.gold - CITY_UPGRADE_COST.gold,
      food: faction.resources.food - CITY_UPGRADE_COST.food,
      wood: faction.resources.wood - CITY_UPGRADE_COST.wood,
      iron: faction.resources.iron - CITY_UPGRADE_COST.iron,
    },
  });

  s = updateCity(s, order.cityId, { level: city.level + 1 });

  s = addLogEntry(
    s,
    `${city.name} upgraded to level ${city.level + 1}.`,
    "city",
    [factionId],
  );

  return s;
}

function executeDeployArmy(
  state: GameState,
  order: CityOrder,
  factionId: FactionId,
): GameState {
  const city = state.cities.get(order.cityId);
  if (!city || !order.generalId || !order.troops) return state;

  const deployTroops: Troops = {
    infantry: order.troops.infantry ?? 0,
    cavalry: order.troops.cavalry ?? 0,
    archer: order.troops.archer ?? 0,
  };

  // Subtract from garrison
  const newGarrison: Troops = {
    infantry: city.garrison.infantry - deployTroops.infantry,
    cavalry: city.garrison.cavalry - deployTroops.cavalry,
    archer: city.garrison.archer - deployTroops.archer,
  };

  let s = updateCity(state, order.cityId, { garrison: newGarrison });

  // Create army at city location
  const armyId = nextArmyId(factionId);
  s = addArmy(s, {
    id: armyId,
    factionId,
    generalId: order.generalId,
    troops: deployTroops,
    coord: city.coord,
    target: null,
    state: "idle",
  });

  s = addLogEntry(
    s,
    `${city.name} deployed army led by ${order.generalId}.`,
    "city",
    [factionId],
  );

  return s;
}

// === Build order execution ===

function executeBuildOrder(
  state: GameState,
  order: BuildOrder,
  factionId: FactionId,
): GameState {
  const validation = validateBuildOrder(state, order, factionId);
  if (!validation.valid) {
    return addLogEntry(
      state,
      `[${factionId}] Invalid build order: ${validation.reason}`,
      "system",
      [factionId],
    );
  }

  const buildingDef = BUILDING_DEFS[order.building];
  const faction = state.factions.get(factionId)!;

  // Deduct resources
  let s = updateFaction(state, factionId, {
    resources: {
      gold: faction.resources.gold - buildingDef.cost.gold,
      food: faction.resources.food - buildingDef.cost.food,
      wood: faction.resources.wood - buildingDef.cost.wood,
      iron: faction.resources.iron - buildingDef.cost.iron,
    },
  });

  // Place building
  s = setTile(s, order.hex, { building: order.building });

  s = addLogEntry(
    s,
    `${factionId} built ${order.building} at ${hexKey(order.hex)}.`,
    "economy",
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

    case "send_tribute":
      return executeSendTribute(state, factionId, order.targetFactionId, order.amount ?? 0);

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

function executeSendTribute(
  state: GameState,
  factionId: FactionId,
  targetId: FactionId,
  amount: number,
): GameState {
  const sender = state.factions.get(factionId);
  const receiver = state.factions.get(targetId);
  if (!sender || !receiver) return state;

  let s = updateFaction(state, factionId, {
    resources: { ...sender.resources, gold: sender.resources.gold - amount },
  });
  s = updateFaction(s, targetId, {
    resources: { ...receiver.resources, gold: receiver.resources.gold + amount },
  });
  s = addLogEntry(
    s,
    `${factionId} sent ${amount} gold tribute to ${targetId}`,
    "diplomacy",
    [factionId, targetId],
  );

  return s;
}

// === Helpers ===

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
