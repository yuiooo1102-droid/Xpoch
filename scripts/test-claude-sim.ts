/**
 * Claude-simulated battle — exports game state each tick for Claude to analyze.
 * Reads decisions from a JSON file, executes them, outputs next state.
 *
 * Usage:
 *   npx tsx scripts/test-claude-sim.ts init          → print initial state
 *   npx tsx scripts/test-claude-sim.ts tick <state.json> <decisions.json> → execute and print next state
 */

import { createInitialState } from "@xpoch/engine";
import {
  executeTurnDecision, processEconomy, processMarches,
  expandTerritory, validateConnectivity, updateTerritoryCounts,
  processRespawns, checkVictory, checkEliminations, advanceTick, addLogEntry,
} from "@xpoch/engine";
import { buildPrompt } from "@xpoch/ai-adapter";
import type { GameState, TurnDecision } from "@xpoch/shared";
import { readFileSync, writeFileSync } from "fs";

const FACTIONS = [
  { id: "f0", name: "蜀汉", modelProvider: "claude", color: "#8B5CF6", historicalFaction: "shu" as const },
  { id: "f1", name: "魏国", modelProvider: "claude", color: "#10B981", historicalFaction: "wei" as const },
  { id: "f2", name: "吴国", modelProvider: "claude", color: "#3B82F6", historicalFaction: "wu" as const },
];

function serializeState(state: GameState): any {
  return {
    ...state,
    tiles: Object.fromEntries(state.tiles),
    armies: Object.fromEntries(state.armies),
    generals: Object.fromEntries(state.generals),
    cities: Object.fromEntries(state.cities),
    factions: Object.fromEntries(state.factions),
    diplomacy: { relations: Object.fromEntries(state.diplomacy.relations) },
  };
}

function deserializeState(raw: any): GameState {
  return {
    ...raw,
    tiles: new Map(Object.entries(raw.tiles)),
    armies: new Map(Object.entries(raw.armies)),
    generals: new Map(Object.entries(raw.generals)),
    cities: new Map(Object.entries(raw.cities)),
    factions: new Map(Object.entries(raw.factions)),
    diplomacy: { relations: new Map(Object.entries(raw.diplomacy.relations)) },
  };
}

function summarize(state: GameState): any {
  const factions: any = {};
  for (const [fid, f] of state.factions) {
    const cities = [...state.cities.values()].filter(c => c.factionId === fid);
    const armies = [...state.armies.values()].filter(a => a.factionId === fid);
    let troops = 0;
    for (const a of armies) troops += a.troops.infantry + a.troops.cavalry + a.troops.archer;
    for (const c of cities) troops += c.garrison.infantry + c.garrison.cavalry + c.garrison.archer;
    factions[f.name] = {
      alive: f.alive, cities: cities.length, armies: armies.length,
      troops, territory: f.territoryCount,
      resources: f.resources, techs: f.techs,
    };
  }
  return {
    tick: state.tick, winner: state.winner, factions,
    recentLog: state.log.slice(-10).map(e => `[T${e.tick}][${e.category}] ${e.message}`),
  };
}

const cmd = process.argv[2];

if (cmd === "init") {
  const state = createInitialState(10, 42, FACTIONS);

  // Save state
  writeFileSync("/tmp/xpoch-state.json", JSON.stringify(serializeState(state), null, 2));

  // Print summary
  console.log(JSON.stringify(summarize(state), null, 2));

  // Print prompts for each faction
  for (const f of FACTIONS) {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`PROMPT FOR ${f.name} (${f.id}):`);
    console.log(`${"=".repeat(60)}`);
    console.log(buildPrompt(state, f.id));
  }

} else if (cmd === "tick") {
  const stateFile = process.argv[3] ?? "/tmp/xpoch-state.json";
  const decisionsFile = process.argv[4] ?? "/tmp/xpoch-decisions.json";

  const rawState = JSON.parse(readFileSync(stateFile, "utf-8"));
  let state = deserializeState(rawState);

  const decisions: TurnDecision[] = JSON.parse(readFileSync(decisionsFile, "utf-8"));

  // Execute
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

  const winner = checkVictory(state);
  if (winner) {
    state = { ...state, winner };
    state = addLogEntry(state, `${state.factions.get(winner)?.name}胜!`, "system", [winner]);
  }
  state = advanceTick(state);

  // Save
  writeFileSync("/tmp/xpoch-state.json", JSON.stringify(serializeState(state), null, 2));

  // Output
  console.log(JSON.stringify(summarize(state), null, 2));

  // Print prompts for alive factions
  for (const [fid, f] of state.factions) {
    if (!f.alive) continue;
    console.log(`\n${"=".repeat(60)}`);
    console.log(`PROMPT FOR ${f.name} (${fid}):`);
    console.log(`${"=".repeat(60)}`);
    console.log(buildPrompt(state, fid));
  }
} else {
  console.log("Usage: npx tsx scripts/test-claude-sim.ts init|tick [state.json] [decisions.json]");
}
