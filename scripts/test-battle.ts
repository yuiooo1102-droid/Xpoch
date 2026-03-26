/**
 * Xpoch Test Battle v3 — Run a full AI game headlessly and produce a report.
 * Usage: npx tsx scripts/test-battle.ts [ticks=60]
 */

import { createInitialState } from "@xpoch/engine";
import {
  executeTurnDecision,
  processEconomy,
  processMarches,
  expandTerritory,
  validateConnectivity,
  updateTerritoryCounts,
  processRespawns,
  checkVictory,
  checkEliminations,
  advanceTick,
  addLogEntry,
} from "@xpoch/engine";
import { MockAdapter } from "@xpoch/ai-adapter";
import type { GameState, FactionId, TurnDecision } from "@xpoch/shared";

const MAX_TICKS = parseInt(process.argv[2] ?? "60", 10);

const FACTIONS = [
  { id: "faction_0", name: "Claude Legion", modelProvider: "mock", color: "#8B5CF6" },
  { id: "faction_1", name: "GPT Horde", modelProvider: "mock", color: "#10B981" },
  { id: "faction_2", name: "Gemini Empire", modelProvider: "mock", color: "#3B82F6" },
];

const adapters = new Map<FactionId, MockAdapter>(
  FACTIONS.map((f) => [f.id, new MockAdapter()])
);

interface TickSnapshot {
  tick: number;
  factions: Record<string, {
    alive: boolean;
    cities: number;
    armies: number;
    totalTroops: number;
    troopBreakdown: { infantry: number; cavalry: number; archer: number };
    generals: { alive: number; dead: number };
    territory: number;
    resources: { gold: number; food: number; wood: number; iron: number };
    techCount: number;
    buildings: Record<string, number>;
  }>;
  events: string[];
  winner: string | null;
}

async function runBattle(): Promise<void> {
  let state = createInitialState(12, Date.now(), FACTIONS);
  const snapshots: TickSnapshot[] = [];

  console.error(`Starting v3 test battle: ${MAX_TICKS} ticks, 3 factions, map radius 12`);

  for (let t = 0; t < MAX_TICKS; t++) {
    // Check victory
    const winner = checkVictory(state);
    if (winner) {
      state = { ...state, winner };
      state = addLogEntry(state, `${state.factions.get(winner)?.name} WINS!`, "system", [winner]);
      snapshots.push(buildSnapshot(state));
      break;
    }

    // Collect AI decisions
    const aliveFactions = [...state.factions.values()].filter((f) => f.alive);
    const decisions: TurnDecision[] = [];
    for (const faction of aliveFactions) {
      const adapter = adapters.get(faction.id);
      if (!adapter) continue;
      try {
        decisions.push(await adapter.decideActions(state, faction.id));
      } catch (err) {
        console.error(`AI error for ${faction.name}:`, err);
        decisions.push({ factionId: faction.id, armies: [], cities: [], build: [], research: null, diplomacy: [] });
      }
    }

    // Execute v3 pipeline
    const logBefore = state.log.length;
    for (const d of decisions) {
      state = executeTurnDecision(state, d);
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
      state = addLogEntry(state, `${state.factions.get(postWinner)?.name} WINS!`, "system", [postWinner]);
    }

    state = advanceTick(state);

    // Snapshot every 5 ticks
    if (t % 5 === 0 || t === MAX_TICKS - 1 || state.winner) {
      snapshots.push(buildSnapshot(state));
    }

    if (state.winner) break;
  }

  const report = {
    config: { maxTicks: MAX_TICKS, mapRadius: 12, factions: FACTIONS.map((f) => f.name) },
    finalTick: state.tick,
    winner: state.winner ? state.factions.get(state.winner)?.name ?? state.winner : null,
    snapshots,
    totalEvents: state.log.length,
    eventsByCategory: categorizeEvents(state),
    combatEvents: state.log.filter((e) => e.message.toLowerCase().includes("battle") || e.message.toLowerCase().includes("captured")).map(
      (e) => `[T${e.tick}] ${e.message}`
    ),
    territoryEvents: state.log.filter((e) => e.category === "territory").map(
      (e) => `[T${e.tick}] ${e.message}`
    ),
    techEvents: state.log.filter((e) => e.category === "tech").map(
      (e) => `[T${e.tick}] ${e.message}`
    ),
    systemErrors: state.log.filter((e) => e.category === "system" && e.message.includes("Invalid")).map(
      (e) => `[T${e.tick}] ${e.message}`
    ),
    issues: detectIssues(state, snapshots),
  };

  console.log(JSON.stringify(report, null, 2));
}

function buildSnapshot(state: GameState): TickSnapshot {
  const factions: TickSnapshot["factions"] = {};

  for (const [fid, f] of state.factions) {
    const cities = [...state.cities.values()].filter((c) => c.factionId === fid);
    const armies = [...state.armies.values()].filter((a) => a.factionId === fid);
    const generals = [...state.generals.values()].filter((g) => g.factionId === fid);

    let totalInf = 0, totalCav = 0, totalArc = 0;
    for (const a of armies) {
      totalInf += a.troops.infantry;
      totalCav += a.troops.cavalry;
      totalArc += a.troops.archer;
    }
    // Add garrison troops
    for (const c of cities) {
      totalInf += c.garrison.infantry;
      totalCav += c.garrison.cavalry;
      totalArc += c.garrison.archer;
    }

    const buildings: Record<string, number> = {};
    for (const t of state.tiles.values()) {
      if (t.building && t.owner === fid) {
        buildings[t.building] = (buildings[t.building] ?? 0) + 1;
      }
    }

    factions[f.name] = {
      alive: f.alive,
      cities: cities.length,
      armies: armies.length,
      totalTroops: totalInf + totalCav + totalArc,
      troopBreakdown: { infantry: totalInf, cavalry: totalCav, archer: totalArc },
      generals: { alive: generals.filter((g) => g.alive).length, dead: generals.filter((g) => !g.alive).length },
      territory: f.territoryCount,
      resources: { ...f.resources },
      techCount: f.techs.length,
      buildings,
    };
  }

  return {
    tick: state.tick,
    factions,
    events: state.log.slice(-5).map((e) => `[${e.category}] ${e.message}`),
    winner: state.winner,
  };
}

function categorizeEvents(state: GameState): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const e of state.log) {
    counts[e.category] = (counts[e.category] ?? 0) + 1;
  }
  return counts;
}

function detectIssues(state: GameState, snapshots: TickSnapshot[]): string[] {
  const issues: string[] = [];

  if (state.tick < 15 && state.winner) {
    issues.push(`GAME_TOO_SHORT: Game ended in ${state.tick} ticks`);
  }
  if (!state.winner && state.tick >= MAX_TICKS) {
    issues.push(`STALEMATE: No winner after ${MAX_TICKS} ticks`);
  }

  for (const snap of snapshots) {
    for (const [name, f] of Object.entries(snap.factions)) {
      if (f.alive && f.armies === 0 && f.totalTroops === 0 && snap.tick > 10) {
        issues.push(`NO_TROOPS: ${name} has 0 troops at tick ${snap.tick}`);
      }
    }
  }

  const battleCount = state.log.filter((e) => e.message.toLowerCase().includes("battle")).length;
  if (battleCount === 0 && state.tick > 20) {
    issues.push(`NO_COMBAT: Zero battles after ${state.tick} ticks`);
  }

  const errorCount = state.log.filter((e) => e.category === "system" && e.message.includes("Invalid")).length;
  if (errorCount > 20) {
    issues.push(`EXCESSIVE_ERRORS: ${errorCount} invalid action errors`);
  }

  // Check territory expansion
  const lastSnap = snapshots[snapshots.length - 1];
  if (lastSnap) {
    for (const [name, f] of Object.entries(lastSnap.factions)) {
      if (f.alive && f.territory <= 7 && lastSnap.tick > 15) {
        issues.push(`NO_EXPANSION: ${name} only has ${f.territory} territory at tick ${lastSnap.tick}`);
      }
    }
  }

  return issues;
}

runBattle().catch((err) => {
  console.error("Battle failed:", err);
  process.exit(1);
});
