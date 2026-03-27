#!/usr/bin/env npx tsx
/**
 * Xpoch Terminal Sandbox — Full game rendered in terminal
 * Usage: npx tsx scripts/tui.ts [tick_ms=2000]
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
import type { GameState, FactionId, TurnDecision, Faction, Army, City, GeneralDef } from "@xpoch/shared";
import { hexKey, hexNeighbors, GENERAL_POOL } from "@xpoch/shared";

// Build a lookup map for general definitions by id
const GENERAL_DEF_MAP = new Map<string, GeneralDef>(
  GENERAL_POOL.map((g) => [g.id, g]),
);

// === Config ===
const TICK_MS = parseInt(process.argv[2] ?? "1500", 10);
const MAP_RADIUS = 12;

const FACTIONS = [
  { id: "f0", name: "蜀汉·Claude", modelProvider: "mock", color: "purple", historicalFaction: "shu" as const },
  { id: "f1", name: "魏国·GPT", modelProvider: "mock", color: "green", historicalFaction: "wei" as const },
  { id: "f2", name: "吴国·Gemini", modelProvider: "mock", color: "blue", historicalFaction: "wu" as const },
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
  plains: `${ESC}[32m·${RESET}`,    // green dot
  forest: `${ESC}[32m♣${RESET}`,    // green club
  mountain: `${ESC}[37m▲${RESET}`,  // white triangle
  water: `${ESC}[34m~${RESET}`,     // blue tilde
  desert: `${ESC}[33m.${RESET}`,    // yellow dot
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

// Log categories to display (filter out training spam)
const IMPORTANT_CATEGORIES = new Set(["combat", "economy", "tech", "diplomacy", "system", "territory"]);
const TRAINING_PATTERN = /started training|finished training/i;

// === Hex to Screen ===
function hexToScreen(q: number, r: number, centerX: number, centerY: number): [number, number] {
  const x = centerX + q * 3 + r * 1;
  const y = centerY + r * 1;
  return [Math.round(x), Math.round(y)];
}

// === Render Functions ===

function renderMap(state: GameState, width: number, height: number): string[] {
  const mapHeight = height;
  const mapWidth = width;
  const centerX = Math.floor(mapWidth / 2);
  const centerY = Math.floor(mapHeight / 2);

  // Initialize grid
  const grid: string[][] = [];
  for (let y = 0; y < mapHeight; y++) {
    grid[y] = [];
    for (let x = 0; x < mapWidth; x++) {
      grid[y][x] = " ";
    }
  }

  // Build army index
  const armyAt = new Map<string, Army[]>();
  for (const army of state.armies.values()) {
    const key = hexKey(army.coord);
    const existing = armyAt.get(key) ?? [];
    existing.push(army);
    armyAt.set(key, existing);
  }

  // Build city index
  const cityAt = new Map<string, City>();
  for (const city of state.cities.values()) {
    cityAt.set(hexKey(city.coord), city);
  }

  // Render tiles
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

function renderCompactFactionPanel(state: GameState, maxHeight: number): string[] {
  const lines: string[] = [];

  for (const [fid, f] of state.factions) {
    const fg = FACTION_FG[fid] ?? "";
    if (!f.alive) {
      lines.push(`${DIM}${fg}✗ ${f.name} [已灭]${RESET}`);
      if (lines.length < maxHeight) lines.push("");
      continue;
    }

    const cities = [...state.cities.values()].filter((c) => c.factionId === fid);
    const armies = [...state.armies.values()].filter((a) => a.factionId === fid);
    const generals = [...state.generals.values()].filter((g) => g.factionId === fid);

    let totalTroops = 0;
    for (const a of armies) totalTroops += a.troops.infantry + a.troops.cavalry + a.troops.archer;
    for (const c of cities) totalTroops += c.garrison.infantry + c.garrison.cavalry + c.garrison.archer;

    // Line 1: faction name with key stats
    lines.push(
      `${BOLD}${fg}◆ ${f.name}${RESET}`,
    );

    // Line 2: territory/cities/armies/troops
    lines.push(
      `  ${f.territoryCount}地 ${cities.length}城 ${armies.length}军 ${totalTroops}兵`,
    );

    // Line 3: resources
    lines.push(
      `  金:${f.resources.gold} 粮:${f.resources.food} 木:${f.resources.wood} 铁:${f.resources.iron}`,
    );

    // Line 4: generals (compact, names only)
    const aliveGens = generals.filter((g) => g.alive);
    const genNames = aliveGens.slice(0, 4).map((g) => g.name).join(" ");
    const moreGens = aliveGens.length > 4 ? ` +${aliveGens.length - 4}` : "";
    lines.push(`  将:${genNames}${moreGens} 技:${f.techs.length}`);

    // Separator
    if (lines.length < maxHeight) {
      lines.push(`${DIM}──────────────────${RESET}`);
    }
  }

  return lines.slice(0, maxHeight);
}

function filterImportantLogs(state: GameState, maxEntries: number): string[] {
  // Filter out training spam, only show important events
  const important = state.log.filter((entry) => {
    if (TRAINING_PATTERN.test(entry.message)) return false;
    if (!IMPORTANT_CATEGORIES.has(entry.category) && entry.category !== "city") return false;
    // Also filter out deploy messages as they're not critical
    if (entry.message.includes("deployed army")) return false;
    return true;
  });

  const recent = important.slice(-maxEntries);
  const catIcon: Record<string, string> = {
    combat: `${ESC}[31m⚔${RESET}`,
    territory: `${ESC}[33m⊞${RESET}`,
    tech: `${ESC}[36m⚗${RESET}`,
    city: `${ESC}[35m♜${RESET}`,
    economy: `${ESC}[32m$${RESET}`,
    diplomacy: `${ESC}[34m☮${RESET}`,
    system: `${ESC}[37m⚙${RESET}`,
  };

  return recent.map((entry) => {
    const icon = catIcon[entry.category] ?? "?";
    const msg = entry.message.length > 35 ? entry.message.slice(0, 32) + "..." : entry.message;
    return `T${entry.tick} ${icon} ${msg}`;
  });
}

function render(state: GameState): void {
  const cols = process.stdout.columns || 120;
  const rows = process.stdout.rows || 40;

  // Layout: bottom 3 lines for log + separator, top area split left/right
  const logHeight = 3;
  const titleHeight = 2; // title + separator
  const legendHeight = 2; // legend + separator
  const contentHeight = rows - titleHeight - legendHeight - logHeight - 1;

  const sidebarWidth = 22;
  const mapWidth = Math.min(cols - sidebarWidth - 3, MAP_RADIUS * 6 + 5);

  const mapLines = renderMap(state, mapWidth, contentHeight);
  const factionLines = renderCompactFactionPanel(state, contentHeight);
  const logEntries = filterImportantLogs(state, logHeight);

  const output: string[] = [];

  // Title bar
  const winnerText = state.winner
    ? `${BOLD}${ESC}[33m  ⚜ ${state.factions.get(state.winner)?.name} 获胜! ⚜${RESET}`
    : "";
  output.push(`${BOLD}${ESC}[33m  ⚔ 率土争霸·三国 ⚔  T${state.tick}${RESET}${winnerText}`);
  output.push(`${"─".repeat(cols)}`);

  // Main content: map on left, faction panel on right
  const maxHeight = Math.max(mapLines.length, factionLines.length);
  for (let i = 0; i < maxHeight; i++) {
    const mapPart = mapLines[i] ?? "";
    const sidePart = factionLines[i] ?? "";
    output.push(`${mapPart}  │ ${sidePart}`);
  }

  // Bottom separator + log
  output.push(`${"─".repeat(cols)}`);

  // Log as horizontal compact entries
  if (logEntries.length > 0) {
    for (const entry of logEntries) {
      output.push(` ${entry}`);
    }
  } else {
    output.push(` ${DIM}等待战报...${RESET}`);
  }

  // Legend
  output.push(
    `${DIM} ★首都 城城池 ■大军 ●中军 •小军 ░领地 ` +
    `${TERRAIN_CHAR["plains"]}原 ${TERRAIN_CHAR["forest"]}林 ${TERRAIN_CHAR["mountain"]}山 ${TERRAIN_CHAR["water"]}水${RESET}`,
  );

  process.stdout.write(CLEAR + output.join("\n") + "\n");
}

// === Game Loop ===

async function main(): Promise<void> {
  process.stdout.write(HIDE_CURSOR);
  process.on("exit", () => process.stdout.write(SHOW_CURSOR));
  process.on("SIGINT", () => { process.stdout.write(SHOW_CURSOR); process.exit(0); });

  let state = createInitialState(MAP_RADIUS, Date.now(), FACTIONS);
  const adapters = new Map<FactionId, MockAdapter>(
    FACTIONS.map((f) => [f.id, new MockAdapter()])
  );

  render(state);

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
    for (const faction of alive) {
      const adapter = adapters.get(faction.id);
      if (!adapter) continue;
      try {
        const decision = await adapter.decideActions(state, faction.id);
        state = executeTurnDecision(state, decision);
      } catch {
        // skip
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
    render(state);

    if (!state.winner) {
      setTimeout(tick, TICK_MS);
    }
  };

  setTimeout(tick, 500);
}

main().catch(console.error);
