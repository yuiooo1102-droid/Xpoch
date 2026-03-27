#!/usr/bin/env npx tsx
/**
 * Xpoch Terminal Sandbox — MLX Apple Silicon Edition
 *
 * Much faster than Ollama because MLX runs natively on Metal GPU.
 * Uses a single mlx_lm.server instance, all 3 factions share it.
 *
 * Setup:
 *   pip install mlx-lm
 *   mlx_lm.server --model mlx-community/Qwen2.5-3B-Instruct-4bit --port 8081
 *
 * Usage:
 *   npx tsx scripts/tui-mlx.ts [tick_ms=8000]
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
import { buildPrompt, parseAIResponse, buildIdMap, remapIds } from "@xpoch/ai-adapter";
import type { GameState, FactionId, TurnDecision, Faction, Army, City, GeneralDef } from "@xpoch/shared";
import { hexKey, GENERAL_POOL } from "@xpoch/shared";

// === Config ===
const TICK_MS = parseInt(process.argv[2] ?? "8000", 10);
const MAP_RADIUS = 10;
const MLX_URL = process.argv[3] ?? "http://localhost:8081";
const MLX_MODEL = process.argv[4] ?? "mlx-community/Qwen2.5-3B-Instruct-4bit";
const AI_TIMEOUT_MS = 15_000;

const GENERAL_DEF_MAP = new Map<string, GeneralDef>(
  GENERAL_POOL.map((g) => [g.id, g]),
);

const FACTIONS = [
  { id: "f0", name: "蜀汉", modelProvider: "mlx" as const, color: "purple", historicalFaction: "shu" as const },
  { id: "f1", name: "魏国", modelProvider: "mlx" as const, color: "green", historicalFaction: "wei" as const },
  { id: "f2", name: "吴国", modelProvider: "mlx" as const, color: "blue", historicalFaction: "wu" as const },
];

// === ANSI Colors ===
const ESC = "\x1b";
const RESET = `${ESC}[0m`;
const BOLD = `${ESC}[1m`;
const DIM = `${ESC}[2m`;
const CLEAR = `${ESC}[2J${ESC}[H`;
const HIDE_CURSOR = `${ESC}[?25l`;
const SHOW_CURSOR = `${ESC}[?25h`;

const FACTION_FG: Record<string, string> = {
  f0: `${ESC}[35m`, f1: `${ESC}[32m`, f2: `${ESC}[34m`,
};

const TERRAIN_CHAR: Record<string, string> = {
  plains: `${ESC}[32m·${RESET}`, forest: `${ESC}[32m♣${RESET}`,
  mountain: `${ESC}[37m▲${RESET}`, water: `${ESC}[34m~${RESET}`,
  desert: `${ESC}[33m.${RESET}`,
};

const BUILDING_CHAR: Record<string, string> = {
  farm: `${ESC}[33m田${RESET}`, lumber_mill: `${ESC}[32m木${RESET}`,
  mine: `${ESC}[37m矿${RESET}`, market: `${ESC}[33m市${RESET}`,
  barracks: `${ESC}[31m兵${RESET}`, watchtower: `${ESC}[36m塔${RESET}`,
  fortress: `${ESC}[31m堡${RESET}`,
};

// === MLX API ===

async function callMLX(prompt: string, factionName: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

  try {
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
      signal: controller.signal,
    });
    const data = await resp.json();
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    const text = (data as any).choices?.[0]?.message?.content ?? "";
    lastAITiming = `${factionName}:${elapsed}s`;
    return text;
  } catch (e) {
    lastAITiming = `${factionName}:timeout`;
    return "";
  } finally {
    clearTimeout(timeout);
  }
}

let lastAITiming = "";
let thinkingFaction = "";

// === Hex to Screen ===
function hexToScreen(q: number, r: number, cx: number, cy: number): [number, number] {
  return [Math.round(cx + q * 3 + r * 1), Math.round(cy + r * 1)];
}

// === Render ===

function render(state: GameState): void {
  const cols = process.stdout.columns || 120;
  const rows = process.stdout.rows || 40;
  const sideW = 32;
  const mapH = rows - 5;
  const mapW = cols - sideW - 3;
  const cx = Math.floor(mapW / 2);
  const cy = Math.floor(mapH / 2);

  const grid: string[][] = Array.from({ length: mapH }, () => Array(mapW).fill(" "));
  const armyAt = new Map<string, Army[]>();
  for (const a of state.armies.values()) {
    const k = hexKey(a.coord);
    armyAt.set(k, [...(armyAt.get(k) ?? []), a]);
  }
  const cityAt = new Map<string, City>();
  for (const c of state.cities.values()) cityAt.set(hexKey(c.coord), c);

  for (const tile of state.tiles.values()) {
    const [sx, sy] = hexToScreen(tile.coord.q, tile.coord.r, cx, cy);
    if (sy < 0 || sy >= mapH || sx < 0 || sx >= mapW) continue;
    const k = hexKey(tile.coord);
    const city = cityAt.get(k);
    const armies = armyAt.get(k);
    if (city) {
      const fg = FACTION_FG[city.factionId] ?? "";
      grid[sy][sx] = `${BOLD}${fg}${city.isCapital ? "★" : "城"}${RESET}`;
    } else if (armies?.length) {
      const fg = FACTION_FG[armies[0].factionId] ?? "";
      const total = armies.reduce((s, a) => s + a.troops.infantry + a.troops.cavalry + a.troops.archer, 0);
      grid[sy][sx] = `${fg}${total >= 500 ? "■" : total >= 200 ? "●" : "•"}${RESET}`;
    } else if (tile.building) {
      grid[sy][sx] = BUILDING_CHAR[tile.building] ?? "?";
    } else if (tile.owner) {
      grid[sy][sx] = `${DIM}${FACTION_FG[tile.owner] ?? ""}░${RESET}`;
    } else {
      grid[sy][sx] = TERRAIN_CHAR[tile.terrain] ?? " ";
    }
  }

  // Side panel
  const side: string[] = [`${BOLD}— 势力 —${RESET}`];
  for (const [fid, f] of state.factions) {
    const fg = FACTION_FG[fid] ?? "";
    if (!f.alive) { side.push(`${DIM}${fg}✗ ${f.name}[灭]${RESET}`); continue; }
    const ca = [...state.cities.values()].filter((c) => c.factionId === fid).length;
    const aa = [...state.armies.values()].filter((a) => a.factionId === fid).length;
    let troops = 0;
    for (const a of state.armies.values()) if (a.factionId === fid) troops += a.troops.infantry + a.troops.cavalry + a.troops.archer;
    for (const c of state.cities.values()) if (c.factionId === fid) troops += c.garrison.infantry + c.garrison.cavalry + c.garrison.archer;
    side.push(`${BOLD}${fg}◆${f.name}${RESET} T${f.territoryCount}`);
    side.push(`  ${ca}城${aa}军${troops}兵 科${f.techs.length}`);
    side.push(`  金${f.resources.gold}粮${f.resources.food}木${f.resources.wood}铁${f.resources.iron}`);
  }
  side.push("");
  side.push(`${BOLD}— 战报 —${RESET}`);
  const important = state.log.filter((e) =>
    e.category === "combat" || e.category === "tech" ||
    (e.category === "economy" && e.message.includes("starv")) ||
    (e.category === "system" && !e.message.includes("Invalid"))
  );
  for (const e of important.slice(-5)) {
    const msg = e.message.length > 28 ? e.message.slice(0, 25) + "..." : e.message;
    side.push(`${DIM}T${e.tick}${RESET} ${msg}`);
  }

  const output: string[] = [];
  const winTxt = state.winner ? `  ${BOLD}${ESC}[33m⚜${state.factions.get(state.winner)?.name}胜!⚜${RESET}` : "";
  const aiTxt = thinkingFaction ? `  ${DIM}${thinkingFaction}思考中...${RESET}` : (lastAITiming ? `  ${DIM}${lastAITiming}${RESET}` : "");
  output.push(`${BOLD}${ESC}[33m⚔率土争霸·三国[MLX]⚔ T${state.tick}${RESET}${winTxt}${aiTxt}`);
  output.push("─".repeat(cols));

  const h = Math.max(mapH, side.length);
  for (let i = 0; i < h; i++) {
    const mapLine = i < mapH ? grid[i].join("") : "";
    const sideLine = side[i] ?? "";
    output.push(`${mapLine} │${sideLine}`);
  }
  output.push("─".repeat(cols));
  output.push(`${DIM}★首都 城城池 ■大军 ●中军 •小军 ░领地 田木矿市兵塔堡=建筑${RESET}`);

  process.stdout.write(CLEAR + output.join("\n") + "\n");
}

// === Game Loop ===

async function main(): Promise<void> {
  // Check MLX server
  try {
    await fetch(`${MLX_URL}/v1/models`);
  } catch {
    console.error(`MLX server not running at ${MLX_URL}`);
    console.error("Start it with: mlx_lm.server --model mlx-community/Qwen2.5-3B-Instruct-4bit --port 8081");
    process.exit(1);
  }

  process.stdout.write(HIDE_CURSOR);
  process.on("exit", () => process.stdout.write(SHOW_CURSOR));
  process.on("SIGINT", () => { process.stdout.write(SHOW_CURSOR); process.exit(0); });

  let state = createInitialState(MAP_RADIUS, Date.now(), FACTIONS);
  render(state);

  const tick = async () => {
    if (state.winner) return;

    const winner = checkVictory(state);
    if (winner) {
      state = { ...state, winner };
      state = addLogEntry(state, `${state.factions.get(winner)?.name}一统天下!`, "system", [winner]);
      render(state);
      return;
    }

    const alive = [...state.factions.values()].filter((f) => f.alive);
    for (const faction of alive) {
      thinkingFaction = faction.name;
      render(state);

      try {
        const prompt = buildPrompt(state, faction.id);
        const idMap = buildIdMap(state, faction.id);
        const text = await callMLX(prompt, faction.name);
        const decision = remapIds(parseAIResponse(text, faction.id, state), idMap);
        state = executeTurnDecision(state, decision);
      } catch {
        // skip on error
      }
    }

    thinkingFaction = "";
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
      state = addLogEntry(state, `${state.factions.get(postWinner)?.name}一统天下!`, "system", [postWinner]);
    }

    state = advanceTick(state);
    render(state);

    if (!state.winner) setTimeout(tick, TICK_MS);
  };

  setTimeout(tick, 500);
}

main().catch(console.error);
