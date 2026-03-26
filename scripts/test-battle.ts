/**
 * Xpoch Test Battle — Run a full AI game headlessly and produce a report.
 *
 * Usage: npx tsx scripts/test-battle.ts [ticks=50]
 *
 * Runs 3 mock AI factions for N ticks, then outputs a structured JSON report
 * to stdout for the reviewer to analyze.
 */

import { createInitialState } from "@xpoch/engine";
import {
  executeTurnDecision,
  processEconomy,
  processCityProduction,
  checkVictory,
  checkEliminations,
  advanceTick,
  addLogEntry,
} from "@xpoch/engine";
import { MockAdapter } from "@xpoch/ai-adapter";
import type { GameState, FactionId, TurnDecision } from "@xpoch/shared";

const MAX_TICKS = parseInt(process.argv[2] ?? "50", 10);

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
    units: number;
    unitBreakdown: Record<string, number>;
    totalStrength: number;
    gold: number;
    food: number;
    research: number;
    techCount: number;
    techs: string[];
    buildings: Record<string, number>;
  }>;
  events: string[];
  winner: string | null;
}

async function runBattle(): Promise<void> {
  let state = createInitialState(10, Date.now(), FACTIONS);
  const snapshots: TickSnapshot[] = [];
  const allEvents: string[] = [];

  console.error(`Starting test battle: ${MAX_TICKS} ticks, 3 factions, map radius 10`);

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
        decisions.push({ factionId: faction.id, military: [], cities: [], research: null, diplomacy: [] });
      }
    }

    // Execute
    const logBefore = state.log.length;
    for (const d of decisions) {
      state = executeTurnDecision(state, d);
    }
    state = processCityProduction(state);
    state = processEconomy(state);
    state = checkEliminations(state);
    state = advanceTick(state);

    // Collect new events
    const newEvents = state.log.slice(logBefore).map((e) => `[T${e.tick}][${e.category}] ${e.message}`);
    allEvents.push(...newEvents);

    // Snapshot every 5 ticks or on last tick
    if (t % 5 === 0 || t === MAX_TICKS - 1 || state.winner) {
      snapshots.push(buildSnapshot(state));
    }

    if (state.winner) break;
  }

  // Build report
  const report = {
    config: { maxTicks: MAX_TICKS, mapRadius: 10, factions: FACTIONS.map((f) => f.name) },
    finalTick: state.tick,
    winner: state.winner ? state.factions.get(state.winner)?.name ?? state.winner : null,
    snapshots,
    totalEvents: state.log.length,
    eventsByCategory: categorizeEvents(state),
    combatEvents: state.log.filter((e) => e.message.includes("battle") || e.message.includes("captured")).map(
      (e) => `[T${e.tick}] ${e.message}`
    ),
    techEvents: state.log.filter((e) => e.category === "tech").map(
      (e) => `[T${e.tick}] ${e.message}`
    ),
    cityEvents: state.log.filter((e) => e.category === "city").map(
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
    const units = [...state.units.values()].filter((u) => u.factionId === fid);
    const unitBreakdown: Record<string, number> = {};
    for (const u of units) {
      unitBreakdown[u.type] = (unitBreakdown[u.type] ?? 0) + 1;
    }
    const buildings: Record<string, number> = {};
    for (const t of state.tiles.values()) {
      if (t.building && (t.isCityOutskirt || t.cityId)) {
        const cid = t.isCityOutskirt ?? t.cityId;
        const city = cid ? state.cities.get(cid) : null;
        if (city?.factionId === fid) {
          buildings[t.building] = (buildings[t.building] ?? 0) + 1;
        }
      }
    }

    factions[f.name] = {
      alive: f.alive,
      cities: cities.length,
      units: units.length,
      unitBreakdown,
      totalStrength: units.reduce((s, u) => s + u.strength, 0),
      gold: f.gold,
      food: f.food,
      research: f.research,
      techCount: f.techs.length,
      techs: [...f.techs],
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

  // Issue: game ended too fast (< 15 ticks)
  if (state.tick < 15 && state.winner) {
    issues.push(`GAME_TOO_SHORT: Game ended in ${state.tick} ticks — not enough strategic depth`);
  }

  // Issue: game never ended (no winner after MAX_TICKS)
  if (!state.winner && state.tick >= MAX_TICKS) {
    issues.push(`STALEMATE: No winner after ${MAX_TICKS} ticks — AI may be stuck or too passive`);
  }

  // Issue: faction had 0 units for extended period
  for (const snap of snapshots) {
    for (const [name, f] of Object.entries(snap.factions)) {
      if (f.alive && f.units === 0 && snap.tick > 5) {
        issues.push(`NO_UNITS: ${name} has 0 units at tick ${snap.tick} — training broken or starvation`);
      }
    }
  }

  // Issue: no battles occurred
  const battleCount = state.log.filter((e) => e.message.includes("battle")).length;
  if (battleCount === 0 && state.tick > 20) {
    issues.push(`NO_COMBAT: Zero battles after ${state.tick} ticks — AI not attacking`);
  }

  // Issue: no tech researched
  for (const f of state.factions.values()) {
    if (f.alive && f.techs.length <= 1 && state.tick > 15) {
      issues.push(`NO_TECH: ${f.name} only has ${f.techs.length} tech at tick ${state.tick} — research broken`);
    }
  }

  // Issue: no buildings built
  const totalBuildings = [...state.tiles.values()].filter((t) => t.building).length;
  if (totalBuildings === 0 && state.tick > 10) {
    issues.push(`NO_BUILDINGS: Zero buildings at tick ${state.tick} — city production broken`);
  }

  // Issue: excessive gold hoarding (> 200)
  for (const f of state.factions.values()) {
    if (f.alive && f.gold > 200) {
      issues.push(`GOLD_HOARDING: ${f.name} has ${f.gold} gold — AI not spending resources`);
    }
  }

  // Issue: too many system errors
  const errorCount = state.log.filter((e) => e.category === "system" && e.message.includes("Invalid")).length;
  if (errorCount > 20) {
    issues.push(`EXCESSIVE_ERRORS: ${errorCount} invalid action errors — AI sending bad commands`);
  }

  // Issue: one faction dominates too early
  if (state.winner && state.tick < 20) {
    const winnerFaction = state.factions.get(state.winner);
    issues.push(`SNOWBALL: ${winnerFaction?.name} won at tick ${state.tick} — early game imbalance`);
  }

  return issues;
}

runBattle().catch((err) => {
  console.error("Battle failed:", err);
  process.exit(1);
});
