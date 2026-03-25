import type {
  GameState,
  FactionId,
  City,
  Unit,
  Tile,
} from "@xpoch/shared";
import { hexKey, hexDistance, hexDisk, TECH_TREE, UNIT_STATS } from "@xpoch/shared";

/**
 * Build a compact prompt for AI decision-making.
 * Optimized for minimal token usage while preserving strategic info.
 */
export function buildPrompt(state: GameState, factionId: FactionId): string {
  const f = state.factions.get(factionId)!;
  const cities = getFactionCities(state, factionId);
  const units = getFactionUnits(state, factionId);
  const unitIndex = buildShortIds(units);

  return [
    `You are "${f.name}" in a hex war game. Destroy all enemies.`,
    `T${state.tick} G:${f.gold} F:${f.food} R:${f.research} Techs:${f.techs.length}`,
    "",
    compactCities(state, cities),
    compactUnits(units, unitIndex),
    compactTech(f.techs),
    compactThreats(state, factionId, cities, units),
    compactDiplomacy(state, factionId),
    "",
    FORMAT_BLOCK,
  ].join("\n");
}

// === Compact sections ===

function compactCities(state: GameState, cities: readonly City[]): string {
  const lines = cities.map((c) => {
    const blds = getOutskirtBuildings(state, c.id);
    const proj = c.currentProject
      ? `${c.currentProject.target}(${c.currentProject.invested}/${c.currentProject.cost})`
      : "-";
    const cap = c.isCapital ? "*" : "";
    return `  ${cap}${c.name}[${hexKey(c.coord)}] prod:${c.production} proj:${proj} bld:[${blds.join(",")}]`;
  });
  return `CITIES(${cities.length}):\n${lines.join("\n")}`;
}

function compactUnits(units: readonly Unit[], idx: ReadonlyMap<string, string>): string {
  // Group by type and summarize
  const byType = new Map<string, { count: number; totalStr: number; positions: string[] }>();
  for (const u of units) {
    const entry = byType.get(u.type) ?? { count: 0, totalStr: 0, positions: [] };
    entry.count++;
    entry.totalStr += u.strength;
    entry.positions.push(`${idx.get(u.id)}@${hexKey(u.coord)}`);
    byType.set(u.type, entry);
  }

  const summary = [...byType.entries()]
    .map(([t, d]) => `${t}:${d.count}(str${d.totalStr})`)
    .join(" ");

  // Only list units individually if <= 15, otherwise just summary
  if (units.length <= 15) {
    const lines = units.map((u) =>
      `  ${idx.get(u.id)} ${u.type} s${u.strength} @${hexKey(u.coord)} m${u.movement}`
    );
    return `UNITS(${units.length}) ${summary}:\n${lines.join("\n")}`;
  }

  return `UNITS(${units.length}) ${summary}`;
}

function compactTech(techs: readonly string[]): string {
  const available = TECH_TREE.filter((t) => {
    if (techs.includes(t.id)) return false;
    return t.prerequisites.every((p) => techs.includes(p));
  });

  const avail = available
    .sort((a, b) => a.cost - b.cost)
    .slice(0, 5)
    .map((t) => `${t.id}(${t.cost})`)
    .join(" ");

  return `TECH known:[${techs.join(",")}] avail:[${avail}]`;
}

function compactThreats(
  state: GameState,
  factionId: FactionId,
  cities: readonly City[],
  units: readonly Unit[],
): string {
  // Only report enemy units and cities within vision — and only the interesting ones
  const visible = computeVisibleHexes(cities, units);
  const enemies: string[] = [];
  const enemyCities: string[] = [];

  // Collect enemy units in vision
  const seenEnemies = new Map<string, { type: string; count: number; totalStr: number; coord: string }>();
  for (const u of state.units.values()) {
    if (u.factionId === factionId) continue;
    const key = hexKey(u.coord);
    if (!visible.has(key)) continue;
    const existing = seenEnemies.get(key);
    if (existing) {
      existing.count++;
      existing.totalStr += u.strength;
    } else {
      seenEnemies.set(key, { type: u.type, count: 1, totalStr: u.strength, coord: key });
    }
  }

  for (const [, e] of seenEnemies) {
    enemies.push(`${e.count}x@${e.coord}(str${e.totalStr})`);
  }

  // Collect enemy cities in vision
  for (const city of state.cities.values()) {
    if (city.factionId === factionId) continue;
    if (!visible.has(hexKey(city.coord))) continue;
    const owner = state.factions.get(city.factionId);
    enemyCities.push(`${city.name}[${hexKey(city.coord)}]${city.isCapital ? "*" : ""}(${owner?.name ?? city.factionId})`);
  }

  // Faction summary (high level threat assessment)
  const factionSummary = [...state.factions.values()]
    .filter((f) => f.id !== factionId && f.alive)
    .map((f) => {
      const fc = [...state.cities.values()].filter((c) => c.factionId === f.id).length;
      const fu = [...state.units.values()].filter((u) => u.factionId === f.id).length;
      return `${f.name}:${fc}c/${fu}u`;
    })
    .join(" ");

  const parts = [`ENEMIES: ${factionSummary}`];
  if (enemyCities.length > 0) parts.push(`  visible_cities: ${enemyCities.join(" ")}`);
  if (enemies.length > 0) parts.push(`  visible_units: ${enemies.join(" ")}`);
  return parts.join("\n");
}

function compactDiplomacy(state: GameState, factionId: FactionId): string {
  const rels: string[] = [];
  for (const [key, status] of state.diplomacy.relations) {
    const [a, b] = key.split(":");
    if (a === factionId || b === factionId) {
      const otherId = a === factionId ? b : a;
      const other = state.factions.get(otherId);
      rels.push(`${other?.name ?? otherId}:${status}`);
    }
  }
  return rels.length > 0 ? `DIPLO: ${rels.join(" ")}` : "DIPLO: none";
}

// Static format block — never changes
const FORMAT_BLOCK = `ACT format JSON:
{"military":[{"unit_id":"ID","action":"move|attack|fortify","to":"q,r"}],
"cities":[{"city_id":"ID","action":"train|build|idle","target":"type","hex":"q,r"}],
"research":"tech_id_or_null",
"diplomacy":[{"action":"declare_war|propose_alliance|offer_peace","target":"faction_id"}]}
train costs: inf=${UNIT_STATS.infantry.cost}g cav=${UNIT_STATS.cavalry.cost}g art=${UNIT_STATS.artillery.cost}g set=${UNIT_STATS.settler.cost}g sct=${UNIT_STATS.scout.cost}g
Trump: inf>cav>art>inf. Attacker moves into enemy hex.`;

// === Helpers ===

function getFactionCities(state: GameState, factionId: FactionId): City[] {
  return [...state.cities.values()].filter((c) => c.factionId === factionId);
}

function getFactionUnits(state: GameState, factionId: FactionId): Unit[] {
  return [...state.units.values()].filter((u) => u.factionId === factionId);
}

function buildShortIds(units: readonly Unit[]): ReadonlyMap<string, string> {
  const map = new Map<string, string>();
  let i = 0;
  for (const u of units) {
    map.set(u.id, `u${i++}`);
  }
  return map;
}

function getOutskirtBuildings(state: GameState, cityId: string): string[] {
  const buildings: string[] = [];
  for (const tile of state.tiles.values()) {
    if (tile.isCityOutskirt === cityId && tile.building) {
      buildings.push(tile.building);
    }
  }
  return buildings;
}

function computeVisibleHexes(
  cities: readonly City[],
  units: readonly Unit[],
): Set<string> {
  const visible = new Set<string>();
  for (const city of cities) {
    for (const coord of hexDisk(city.coord, 2)) {
      visible.add(hexKey(coord));
    }
  }
  for (const unit of units) {
    const range = unit.type === "scout" ? 3 : 2;
    for (const coord of hexDisk(unit.coord, range)) {
      visible.add(hexKey(coord));
    }
  }
  return visible;
}
