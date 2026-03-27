/**
 * Claude plays as 3 AIs — hand-crafted strategic decisions for 20 ticks.
 * Collects all issues encountered for debugging.
 */
import { createInitialState } from "@xpoch/engine";
import {
  executeTurnDecision, processEconomy, processMarches,
  expandTerritory, validateConnectivity, updateTerritoryCounts,
  processRespawns, checkVictory, checkEliminations, advanceTick, addLogEntry,
} from "@xpoch/engine";
import { hexKey } from "@xpoch/shared";
import type { GameState, TurnDecision, FactionId, HexCoord } from "@xpoch/shared";

const FACTIONS = [
  { id: "f0", name: "蜀汉", modelProvider: "claude", color: "#8B5CF6", historicalFaction: "shu" as const },
  { id: "f1", name: "魏国", modelProvider: "claude", color: "#10B981", historicalFaction: "wei" as const },
  { id: "f2", name: "吴国", modelProvider: "claude", color: "#3B82F6", historicalFaction: "wu" as const },
];

// Helper: find available generals for a faction
function availableGenerals(state: GameState, fid: FactionId): string[] {
  const deployedIds = new Set([...state.armies.values()].filter(a => a.factionId === fid).map(a => a.generalId));
  return [...state.generals.values()]
    .filter(g => g.factionId === fid && g.alive && !deployedIds.has(g.id))
    .map(g => g.id);
}

// Helper: get army general IDs for a faction
function armyGenerals(state: GameState, fid: FactionId): string[] {
  return [...state.armies.values()].filter(a => a.factionId === fid).map(a => a.generalId);
}

// Helper: find an owned tile with specific terrain and no building
function findBuildHex(state: GameState, fid: FactionId, terrain: string): HexCoord | null {
  for (const tile of state.tiles.values()) {
    if (tile.owner === fid && tile.terrain === terrain && !tile.building && !tile.cityId) {
      return tile.coord;
    }
  }
  return null;
}

// Helper: find a neutral tile adjacent to territory
function findExpansionTarget(state: GameState, fid: FactionId, from: HexCoord): HexCoord | null {
  const { hexNeighbors } = require("@xpoch/shared");
  for (const nb of hexNeighbors(from)) {
    const tile = state.tiles.get(hexKey(nb));
    if (tile && tile.owner === null && tile.terrain !== "water") return nb;
  }
  return null;
}

// Claude's strategic decision-making for each faction each tick
function makeDecision(state: GameState, fid: FactionId): TurnDecision {
  const faction = state.factions.get(fid)!;
  const armies = armyGenerals(state, fid);
  const availGens = availableGenerals(state, fid);
  const cities = [...state.cities.values()].filter(c => c.factionId === fid);
  const city = cities[0];
  const tick = state.tick;

  const decision: TurnDecision = {
    factionId: fid,
    armies: [],
    cities: [],
    build: [],
    research: null,
    diplomacy: [],
  };

  // === ARMY ORDERS ===
  const armyOrders: TurnDecision["armies"][number][] = [];

  for (const genId of armies) {
    const army = [...state.armies.values()].find(a => a.generalId === genId);
    if (!army) continue;

    // Find nearest enemy city
    const enemyCities = [...state.cities.values()].filter(c => c.factionId !== fid);
    let nearestEnemy: { coord: HexCoord; dist: number } | null = null;
    for (const ec of enemyCities) {
      const { hexDistance } = require("@xpoch/shared");
      const d = hexDistance(army.coord, ec.coord);
      if (!nearestEnemy || d < nearestEnemy.dist) nearestEnemy = { coord: ec.coord, dist: d };
    }

    if (tick < 8) {
      // Early game: expand territory
      const target = findExpansionTarget(state, fid, army.coord);
      if (target) {
        armyOrders.push({ generalId: genId, action: "march", target });
      } else {
        armyOrders.push({ generalId: genId, action: "idle" });
      }
    } else if (nearestEnemy && nearestEnemy.dist <= 1) {
      // Adjacent to enemy city: ATTACK
      armyOrders.push({ generalId: genId, action: "attack", target: nearestEnemy.coord });
    } else if (nearestEnemy) {
      // March toward enemy
      armyOrders.push({ generalId: genId, action: "march", target: nearestEnemy.coord });
    } else {
      armyOrders.push({ generalId: genId, action: "idle" });
    }
  }

  // === DEPLOY NEW ARMY if generals available and garrison has troops ===
  if (availGens.length > 0 && city && tick >= 5) {
    const garTotal = city.garrison.infantry + city.garrison.cavalry + city.garrison.archer;
    if (garTotal >= 400) {
      // Deploy half the garrison
      const inf = Math.floor(city.garrison.infantry / 2);
      const cav = Math.floor(city.garrison.cavalry / 2);
      const arc = Math.floor(city.garrison.archer / 2);
      if (inf + cav + arc >= 200) {
        return {
          ...decision,
          armies: armyOrders,
          cities: [{
            cityId: city.id,
            action: "deploy",
            generalId: availGens[0],
            troops: { infantry: inf, cavalry: cav, archer: arc },
          }],
          build: decision.build,
          research: pickResearch(faction),
        };
      }
    }
  }

  // === CITY ORDERS: train if no queue ===
  const cityOrders: TurnDecision["cities"][number][] = [];
  for (const c of cities) {
    if (c.trainingQueue) {
      cityOrders.push({ cityId: c.id, action: "idle" });
    } else {
      // Alternate troop types
      const types = ["infantry", "cavalry", "archer"] as const;
      const troopType = types[tick % 3];
      cityOrders.push({ cityId: c.id, action: "train", troopType, amount: 100 });
    }
  }

  // === BUILD ===
  const buildOrders: TurnDecision["build"][number][] = [];
  if (tick < 10) {
    // Build farms for food
    const farmHex = findBuildHex(state, fid, "plains");
    if (farmHex) buildOrders.push({ hex: farmHex, building: "farm" });
    // Build lumber mill
    const lumberHex = findBuildHex(state, fid, "forest");
    if (lumberHex) buildOrders.push({ hex: lumberHex, building: "lumber_mill" });
  }

  // === RESEARCH ===
  const research = pickResearch(faction);

  return {
    ...decision,
    armies: armyOrders,
    cities: cityOrders,
    build: buildOrders,
    research,
  };
}

function pickResearch(faction: { techs: readonly string[]; resources: { gold: number } }): string | null {
  const { TECH_TREE } = require("@xpoch/shared");
  const available = TECH_TREE.filter((t: any) => {
    if (faction.techs.includes(t.id)) return false;
    return t.prerequisites.every((p: string) => faction.techs.includes(p));
  });
  if (available.length === 0) return null;
  // Priority: agriculture > logging > mining > archery > horsemanship > others
  const priority = ["agriculture", "logging", "mining", "archery", "horsemanship", "iron_working", "masonry"];
  for (const p of priority) {
    const found = available.find((t: any) => t.id === p);
    if (found && faction.resources.gold >= found.cost.gold) return found.id;
  }
  return available[0].id;
}

// === MAIN: Run 20 ticks ===
async function main() {
  let state = createInitialState(10, 42, FACTIONS);
  const issues: string[] = [];

  for (let t = 0; t < 20; t++) {
    const winner = checkVictory(state);
    if (winner) {
      state = { ...state, winner };
      break;
    }

    const logBefore = state.log.length;

    // Each faction makes decisions
    for (const f of FACTIONS) {
      if (!state.factions.get(f.id)?.alive) continue;
      const decision = makeDecision(state, f.id);
      state = executeTurnDecision(state, decision);
    }

    state = processMarches(state);
    state = expandTerritory(state);
    state = validateConnectivity(state);
    state = updateTerritoryCounts(state);
    state = processEconomy(state);
    state = processRespawns(state);
    state = checkEliminations(state);

    const postWinner = checkVictory(state);
    if (postWinner) {
      state = { ...state, winner: postWinner };
      state = addLogEntry(state, `${state.factions.get(postWinner)?.name}胜!`, "system", [postWinner]);
    }
    state = advanceTick(state);

    // Collect errors from this tick
    const newErrors = state.log.slice(logBefore).filter(e => e.category === "system" && e.message.includes("Invalid"));
    for (const e of newErrors) issues.push(`T${e.tick}: ${e.message}`);

    // Print tick summary
    const parts: string[] = [];
    for (const [fid, f] of state.factions) {
      const c = [...state.cities.values()].filter(x => x.factionId === fid).length;
      const a = [...state.armies.values()].filter(x => x.factionId === fid);
      let troops = 0;
      for (const x of a) troops += x.troops.infantry + x.troops.cavalry + x.troops.archer;
      for (const x of [...state.cities.values()].filter(x => x.factionId === fid)) troops += x.garrison.infantry + x.garrison.cavalry + x.garrison.archer;
      const buildings = [...state.tiles.values()].filter(x => x.owner === fid && x.building).length;
      if (!f.alive) parts.push(`${f.name}:DEAD`);
      else parts.push(`${f.name}:${c}城${a.length}军${troops}兵T${f.territoryCount}建${buildings}`);
    }
    console.log(`T${state.tick}: ${parts.join(" | ")}`);

    // Print important events
    const important = state.log.slice(logBefore).filter(e => e.category === "combat" || e.category === "tech" || (e.category === "city" && e.message.includes("deploy")));
    for (const e of important) console.log(`  ⚡ [${e.category}] ${e.message}`);

    if (state.winner) break;
  }

  console.log(`\nWinner: ${state.winner ? state.factions.get(state.winner)?.name : "none"}`);
  console.log(`\nISSUES (${issues.length}):`);
  // Group issues
  const grouped = new Map<string, number>();
  for (const i of issues) {
    const key = i.replace(/T\d+: /, "").slice(0, 80);
    grouped.set(key, (grouped.get(key) ?? 0) + 1);
  }
  for (const [msg, cnt] of [...grouped.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)) {
    console.log(`  ${cnt}x ${msg}`);
  }
}

main().catch(console.error);
