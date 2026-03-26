#!/usr/bin/env npx tsx
/**
 * Xpoch Terminal Sandbox — Ollama Local Models Edition
 * Usage: npx tsx scripts/tui-ollama.ts [tick_ms=15000]
 *
 * Requires Ollama running at localhost:11434 with:
 *   - glm-4.7-flash:latest
 *   - qwen3:8b
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
import { OpenAICompatibleAdapter } from "@xpoch/ai-adapter";
import type { GameState, FactionId, TurnDecision, Faction, Army, City } from "@xpoch/shared";
import { hexKey, hexNeighbors } from "@xpoch/shared";

// === Config ===
const TICK_MS = parseInt(process.argv[2] ?? "15000", 10);
const MAP_RADIUS = 10;
const AI_TIMEOUT_MS = 12_000;

const OLLAMA_BASE_URL = "http://localhost:11434/v1";
const OLLAMA_API_KEY = "ollama";

const FACTION_MODELS: ReadonlyArray<{
  readonly id: string;
  readonly name: string;
  readonly model: string;
  readonly color: string;
}> = [
  { id: "f0", name: "蜀汉·GLM",   model: "glm-4.7-flash:latest", color: "purple" },
  { id: "f1", name: "魏国·Qwen",   model: "qwen3:8b",             color: "green"  },
  { id: "f2", name: "吴国·GLM",    model: "glm-4.7-flash:latest", color: "blue"   },
];

const FACTIONS = FACTION_MODELS.map((f) => ({
  id: f.id,
  name: f.name,
  modelProvider: "ollama" as const,
  color: f.color,
}));

// === ANSI Colors ===
const ESC = "\x1b";
const RESET = `${ESC}[0m`;
const BOLD = `${ESC}[1m`;
const DIM = `${ESC}[2m`;
const CLEAR = `${ESC}[2J${ESC}[H`;
const HIDE_CURSOR = `${ESC}[?25l`;
const SHOW_CURSOR = `${ESC}[?25h`;

const FACTION_FG: Record<string, string> = {
  f0: `${ESC}[35m`, // purple/magenta
  f1: `${ESC}[32m`, // green
  f2: `${ESC}[34m`, // blue
};

const FACTION_BG: Record<string, string> = {
  f0: `${ESC}[45m`,
  f1: `${ESC}[42m`,
  f2: `${ESC}[44m`,
};

const TERRAIN_CHAR: Record<string, string> = {
  plains: `${ESC}[32m·${RESET}`,
  forest: `${ESC}[32m♣${RESET}`,
  mountain: `${ESC}[37m▲${RESET}`,
  water: `${ESC}[34m~${RESET}`,
  desert: `${ESC}[33m.${RESET}`,
};

const BUILDING_CHAR: Record<string, string> = {
  farm: `${ESC}[33m田${RESET}`,
  lumber_mill: `${ESC}[32m木${RESET}`,
  mine: `${ESC}[37m矿${RESET}`,
  market: `${ESC}[33m市${RESET}`,
  barracks: `${ESC}[31m兵${RESET}`,
  watchtower: `${ESC}[36m塔${RESET}`,
  fortress: `${ESC}[31m堡${RESET}`,
};

// === AI Response Timing ===
let lastAIStatus = "";

// === Hex to Screen ===
function hexToScreen(q: number, r: number, centerX: number, centerY: number): [number, number] {
  const x = centerX + q * 3 + r * 1;
  const y = centerY + r * 1;
  return [Math.round(x), Math.round(y)];
}

// === Render Functions ===

function renderMap(state: GameState, width: number, height: number): readonly string[] {
  const mapHeight = Math.min(height - 12, MAP_RADIUS * 2 + 3);
  const mapWidth = Math.min(width - 35, MAP_RADIUS * 6 + 5);
  const centerX = Math.floor(mapWidth / 2);
  const centerY = Math.floor(mapHeight / 2);

  const grid: string[][] = [];
  for (let y = 0; y < mapHeight; y++) {
    grid[y] = [];
    for (let x = 0; x < mapWidth; x++) {
      grid[y][x] = " ";
    }
  }

  const armyAt = new Map<string, readonly Army[]>();
  for (const army of state.armies.values()) {
    const key = hexKey(army.coord);
    const existing = armyAt.get(key) ?? [];
    armyAt.set(key, [...existing, army]);
  }

  const cityAt = new Map<string, City>();
  for (const city of state.cities.values()) {
    cityAt.set(hexKey(city.coord), city);
  }

  for (const tile of state.tiles.values()) {
    const [sx, sy] = hexToScreen(tile.coord.q, tile.coord.r, centerX, centerY);
    if (sy < 0 || sy >= mapHeight || sx < 0 || sx >= mapWidth) continue;

    const key = hexKey(tile.coord);
    const city = cityAt.get(key);
    const armies = armyAt.get(key);

    if (city) {
      const fg = FACTION_FG[city.factionId] ?? "";
      const cap = city.isCapital ? "★" : "城";
      grid[sy][sx] = `${BOLD}${fg}${cap}${RESET}`;
    } else if (armies && armies.length > 0) {
      const army = armies[0];
      const fg = FACTION_FG[army.factionId] ?? "";
      const total = army.troops.infantry + army.troops.cavalry + army.troops.archer;
      const ch = total >= 500 ? "■" : total >= 200 ? "●" : "•";
      grid[sy][sx] = `${fg}${ch}${RESET}`;
    } else if (tile.building) {
      grid[sy][sx] = BUILDING_CHAR[tile.building] ?? "?";
    } else if (tile.owner) {
      const fg = FACTION_FG[tile.owner] ?? "";
      grid[sy][sx] = `${DIM}${fg}░${RESET}`;
    } else {
      grid[sy][sx] = TERRAIN_CHAR[tile.terrain] ?? " ";
    }
  }

  return grid.map((row) => row.join(""));
}

function renderFactionPanel(state: GameState): readonly string[] {
  const lines: string[] = [];
  lines.push(`${BOLD}━━━ 势力 ━━━${RESET}`);

  for (const [fid, f] of state.factions) {
    const fg = FACTION_FG[fid] ?? "";
    if (!f.alive) {
      lines.push(`${DIM}${fg}✗ ${f.name} [已灭]${RESET}`);
      continue;
    }

    const cities = [...state.cities.values()].filter((c) => c.factionId === fid);
    const armies = [...state.armies.values()].filter((a) => a.factionId === fid);
    const generals = [...state.generals.values()].filter((g) => g.factionId === fid);

    let totalTroops = 0;
    for (const a of armies) totalTroops += a.troops.infantry + a.troops.cavalry + a.troops.archer;
    for (const c of cities) totalTroops += c.garrison.infantry + c.garrison.cavalry + c.garrison.archer;

    const modelInfo = FACTION_MODELS.find((fm) => fm.id === fid);
    lines.push(`${BOLD}${fg}◆ ${f.name}${RESET} ${DIM}(${modelInfo?.model ?? "??"})${RESET}`);
    lines.push(`  领地:${f.territoryCount} 城:${cities.length} 军:${armies.length} 兵:${totalTroops}`);
    lines.push(`  金:${f.resources.gold} 粮:${f.resources.food} 木:${f.resources.wood} 铁:${f.resources.iron}`);

    const genStrs = generals.map((g) => {
      const alive = g.alive ? `Lv${g.level}` : `☠`;
      return `${g.name}(${alive})`;
    }).join(" ");
    lines.push(`  将:${genStrs}`);

    lines.push(`  科技:${f.techs.length}`);
    lines.push("");
  }

  return lines;
}

function renderLog(state: GameState, maxLines: number): readonly string[] {
  const lines: string[] = [];
  lines.push(`${BOLD}━━━ 战报 ━━━${RESET}`);

  const recent = state.log.slice(-maxLines);
  for (const entry of recent) {
    const catIcon: Record<string, string> = {
      combat: `${ESC}[31m⚔${RESET}`,
      territory: `${ESC}[33m⊞${RESET}`,
      tech: `${ESC}[36m⚗${RESET}`,
      city: `${ESC}[35m♜${RESET}`,
      economy: `${ESC}[32m$${RESET}`,
      diplomacy: `${ESC}[34m☮${RESET}`,
      system: `${ESC}[37m⚙${RESET}`,
    };
    const icon = catIcon[entry.category] ?? "?";
    const msg = entry.message.length > 40 ? entry.message.slice(0, 37) + "..." : entry.message;
    lines.push(`${DIM}T${entry.tick}${RESET} ${icon} ${msg}`);
  }

  return lines;
}

function render(state: GameState, statusLine?: string): void {
  const cols = process.stdout.columns || 120;
  const rows = process.stdout.rows || 40;

  const sidebarWidth = 34;
  const mapLines = renderMap(state, cols - sidebarWidth - 2, rows - 2);
  const factionLines = renderFactionPanel(state);
  const logMaxLines = rows - factionLines.length - 6;
  const logLines = renderLog(state, Math.max(5, logMaxLines));

  const output: string[] = [];

  const winnerText = state.winner
    ? `${BOLD}${ESC}[33m  ⚜ ${state.factions.get(state.winner)?.name} 获胜! ⚜${RESET}`
    : "";
  const status = statusLine
    ? `  ${DIM}${statusLine}${RESET}`
    : "";
  output.push(`${BOLD}${ESC}[33m  ⚔ XPOCH 率土争霸 [Ollama] ⚔  T${state.tick}${RESET}${winnerText}${status}`);
  output.push(`${"─".repeat(cols)}`);

  const sideLines = [...factionLines, "", ...logLines];
  const maxHeight = Math.max(mapLines.length, sideLines.length);

  for (let i = 0; i < maxHeight; i++) {
    const mapPart = mapLines[i] ?? "";
    const sidePart = sideLines[i] ?? "";
    output.push(`${mapPart}  │ ${sidePart}`);
  }

  process.stdout.write(CLEAR + output.join("\n") + "\n");
}

// === Timeout helper ===
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label}: timeout after ${ms}ms`)), ms),
    ),
  ]);
}

// === Ollama health check ===
async function checkOllama(): Promise<boolean> {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/models`);
    return response.ok;
  } catch {
    return false;
  }
}

// === Empty decision fallback ===
function emptyDecision(factionId: FactionId): TurnDecision {
  return {
    factionId,
    armies: [],
    buildOrders: [],
    recruitOrders: [],
    techOrders: [],
    diplomacyOrders: [],
  };
}

// === Game Loop ===

async function main(): Promise<void> {
  // Check Ollama is available
  const ollamaUp = await checkOllama();
  if (!ollamaUp) {
    console.error(`\n${BOLD}${ESC}[31mError: Ollama is not running at ${OLLAMA_BASE_URL}${RESET}`);
    console.error(`\nPlease start Ollama and ensure these models are available:`);
    console.error(`  ollama pull glm-4.7-flash`);
    console.error(`  ollama pull qwen3:8b`);
    console.error(`\nThen run: npx tsx scripts/tui-ollama.ts\n`);
    process.exit(1);
  }

  process.stdout.write(HIDE_CURSOR);
  process.on("exit", () => process.stdout.write(SHOW_CURSOR));
  process.on("SIGINT", () => { process.stdout.write(SHOW_CURSOR); process.exit(0); });

  let state = createInitialState(MAP_RADIUS, Date.now(), FACTIONS);

  const adapters = new Map<FactionId, OpenAICompatibleAdapter>(
    FACTION_MODELS.map((f) => [
      f.id,
      new OpenAICompatibleAdapter(
        "ollama",
        OLLAMA_API_KEY,
        OLLAMA_BASE_URL,
        f.model,
      ),
    ]),
  );

  render(state, "Ollama models loaded. Starting...");

  const tick = async () => {
    if (state.winner) return;

    const winner = checkVictory(state);
    if (winner) {
      state = { ...state, winner };
      state = addLogEntry(state, `${state.factions.get(winner)?.name} 一统天下!`, "system", [winner]);
      render(state);
      return;
    }

    // AI decisions
    const alive = [...state.factions.values()].filter((f) => f.alive);
    const timings: string[] = [];

    for (const faction of alive) {
      const adapter = adapters.get(faction.id);
      if (!adapter) continue;

      const modelInfo = FACTION_MODELS.find((fm) => fm.id === faction.id);
      render(state, `${faction.name} thinking... (${modelInfo?.model ?? "??"})`);

      const startMs = Date.now();
      try {
        const decision = await withTimeout(
          adapter.decideActions(state, faction.id),
          AI_TIMEOUT_MS,
          faction.name,
        );
        const elapsed = Date.now() - startMs;
        timings.push(`${faction.name}:${(elapsed / 1000).toFixed(1)}s`);
        state = executeTurnDecision(state, decision);
      } catch (err) {
        const elapsed = Date.now() - startMs;
        const message = err instanceof Error ? err.message : String(err);
        timings.push(`${faction.name}:ERR`);
        state = addLogEntry(
          state,
          `${faction.name} AI error (${(elapsed / 1000).toFixed(1)}s): ${message.slice(0, 50)}`,
          "system",
          [faction.id],
        );
      }
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
      state = addLogEntry(state, `${state.factions.get(postWinner)?.name} 一统天下!`, "system", [postWinner]);
    }

    state = advanceTick(state);
    lastAIStatus = timings.join("  ");
    render(state, lastAIStatus);

    if (!state.winner) {
      setTimeout(tick, TICK_MS);
    }
  };

  setTimeout(tick, 500);
}

main().catch((err) => {
  process.stdout.write(SHOW_CURSOR);
  console.error("Fatal error:", err);
  process.exit(1);
});
