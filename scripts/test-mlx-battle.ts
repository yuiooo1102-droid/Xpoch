/**
 * MLX Battle Test — Run a full AI game with MLX and collect diagnostics.
 * Usage: npx tsx scripts/test-mlx-battle.ts [ticks=40] [mlx_url=http://localhost:8081]
 */

import { createInitialState } from "@xpoch/engine";
import {
  executeTurnDecision, processEconomy, processMarches,
  expandTerritory, validateConnectivity, updateTerritoryCounts,
  processRespawns, checkVictory, checkEliminations, advanceTick, addLogEntry,
} from "@xpoch/engine";
import { buildPrompt, parseAIResponse, buildIdMap, remapIds } from "@xpoch/ai-adapter";
import type { GameState, FactionId, TurnDecision } from "@xpoch/shared";

const MAX_TICKS = parseInt(process.argv[2] ?? "40", 10);
const MLX_URL = process.argv[3] ?? "http://localhost:8081";
const MLX_MODEL = "mlx-community/Qwen2.5-3B-Instruct-4bit";

const FACTIONS = [
  { id: "f0", name: "蜀汉", modelProvider: "mlx", color: "#8B5CF6", historicalFaction: "shu" as const },
  { id: "f1", name: "魏国", modelProvider: "mlx", color: "#10B981", historicalFaction: "wei" as const },
  { id: "f2", name: "吴国", modelProvider: "mlx", color: "#3B82F6", historicalFaction: "wu" as const },
];

interface AICall {
  tick: number;
  faction: string;
  elapsed_ms: number;
  prompt_length: number;
  response_length: number;
  parsed_ok: boolean;
  armies_count: number;
  cities_count: number;
  has_research: boolean;
  has_build: boolean;
  raw_response: string;
}

async function callMLX(prompt: string): Promise<{ text: string; elapsed: number }> {
  const start = Date.now();
  const resp = await fetch(`${MLX_URL}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MLX_MODEL,
      max_tokens: 1024,
      temperature: 0.3,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const data = await resp.json();
  const text = (data as any).choices?.[0]?.message?.content ?? "";
  return { text, elapsed: Date.now() - start };
}

async function runBattle() {
  let state = createInitialState(10, Date.now(), FACTIONS);
  const aiCalls: AICall[] = [];
  const parseErrors: string[] = [];

  console.error(`MLX Battle Test: ${MAX_TICKS} ticks, model=${MLX_MODEL}`);

  for (let t = 0; t < MAX_TICKS; t++) {
    const winner = checkVictory(state);
    if (winner) {
      state = { ...state, winner };
      state = addLogEntry(state, `${state.factions.get(winner)?.name}胜!`, "system", [winner]);
      break;
    }

    const alive = [...state.factions.values()].filter((f) => f.alive);
    for (const faction of alive) {
      const prompt = buildPrompt(state, faction.id);
      const idMap = buildIdMap(state, faction.id);

      let text = "";
      let elapsed = 0;
      try {
        const result = await callMLX(prompt);
        text = result.text;
        elapsed = result.elapsed;
      } catch (e) {
        parseErrors.push(`T${t} ${faction.name}: fetch error: ${(e as Error).message}`);
        continue;
      }

      const decision = remapIds(parseAIResponse(text, faction.id, state), idMap);

      const call: AICall = {
        tick: t,
        faction: faction.name,
        elapsed_ms: elapsed,
        prompt_length: prompt.length,
        response_length: text.length,
        parsed_ok: decision.armies.length > 0 || decision.cities.length > 0 || decision.research !== null || decision.build.length > 0,
        armies_count: decision.armies.length,
        cities_count: decision.cities.length,
        has_research: decision.research !== null,
        has_build: decision.build.length > 0,
        raw_response: text.slice(0, 500),
      };
      aiCalls.push(call);

      if (!call.parsed_ok) {
        parseErrors.push(`T${t} ${faction.name}: empty decision. Raw: ${text.slice(0, 200)}`);
      }

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
    if (state.winner) break;
  }

  // === Build Report ===
  const totalCalls = aiCalls.length;
  const parsedOk = aiCalls.filter((c) => c.parsed_ok).length;
  const avgElapsed = totalCalls > 0 ? aiCalls.reduce((s, c) => s + c.elapsed_ms, 0) / totalCalls : 0;
  const withArmies = aiCalls.filter((c) => c.armies_count > 0).length;
  const withCities = aiCalls.filter((c) => c.cities_count > 0).length;
  const withResearch = aiCalls.filter((c) => c.has_research).length;
  const withBuild = aiCalls.filter((c) => c.has_build).length;

  const report = {
    summary: {
      ticks: state.tick,
      winner: state.winner ? state.factions.get(state.winner)?.name : null,
      total_ai_calls: totalCalls,
      parsed_ok: parsedOk,
      parse_rate: `${((parsedOk / Math.max(totalCalls, 1)) * 100).toFixed(0)}%`,
      avg_response_ms: Math.round(avgElapsed),
      calls_with_army_orders: withArmies,
      calls_with_city_orders: withCities,
      calls_with_research: withResearch,
      calls_with_build: withBuild,
    },
    factions_final: Object.fromEntries(
      [...state.factions].map(([id, f]) => {
        const cities = [...state.cities.values()].filter((c) => c.factionId === id);
        const armies = [...state.armies.values()].filter((a) => a.factionId === id);
        let troops = 0;
        for (const a of armies) troops += a.troops.infantry + a.troops.cavalry + a.troops.archer;
        for (const c of cities) troops += c.garrison.infantry + c.garrison.cavalry + c.garrison.archer;
        return [f.name, {
          alive: f.alive, cities: cities.length, armies: armies.length,
          troops, territory: f.territoryCount, resources: f.resources, techs: f.techs,
        }];
      })
    ),
    parse_errors: parseErrors,
    sample_responses: aiCalls.slice(0, 6).map((c) => ({
      tick: c.tick, faction: c.faction, elapsed_ms: c.elapsed_ms,
      parsed_ok: c.parsed_ok, response: c.raw_response,
    })),
    combat_log: state.log
      .filter((e) => e.category === "combat" || e.message.includes("captured"))
      .map((e) => `[T${e.tick}] ${e.message}`),
    system_errors: state.log
      .filter((e) => e.category === "system" && e.message.includes("Invalid"))
      .map((e) => `[T${e.tick}] ${e.message}`),
  };

  console.log(JSON.stringify(report, null, 2));
}

runBattle().catch((e) => { console.error("Battle failed:", e); process.exit(1); });
