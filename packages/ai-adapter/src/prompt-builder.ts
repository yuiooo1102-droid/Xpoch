import type {
  GameState,
  FactionId,
  City,
  Army,
  General,
} from "@xpoch/shared";
import { hexKey, hexDistance, hexDisk, TECH_TREE, TROOP_STATS } from "@xpoch/shared";

/**
 * Build a compact prompt for AI decision-making.
 * Optimized for minimal token usage while preserving strategic info.
 * v3: shows generals, armies (general + troops), cities, territory, resources.
 */
export function buildPrompt(state: GameState, factionId: FactionId): string {
  const f = state.factions.get(factionId)!;
  const cities = getFactionCities(state, factionId);
  const armies = getFactionArmies(state, factionId);
  const generals = getFactionGenerals(state, factionId);

  return [
    `You are "${f.name}" in a hex war game. Destroy all enemies.`,
    `T${state.tick} G:${f.resources.gold} F:${f.resources.food} W:${f.resources.wood} I:${f.resources.iron} Terr:${f.territoryCount} Techs:${f.techs.length}`,
    "",
    compactGenerals(generals, state),
    compactArmies(armies, state),
    compactCities(cities),
    compactTech(f.techs),
    compactThreats(state, factionId, cities, armies),
    compactDiplomacy(state, factionId),
    "",
    FORMAT_BLOCK,
  ].join("\n");
}

// === Compact sections ===

function compactGenerals(generals: readonly General[], state: GameState): string {
  const lines = generals.map((g) => {
    const status = g.alive
      ? `lv${g.level}`
      : `dead(respawn T${g.respawnTick ?? "?"})`;
    return `  ${g.name}[${g.id}] ${g.specialty ?? "all"} ${status}`;
  });
  return `GENERALS(${generals.length}):\n${lines.join("\n")}`;
}

function compactArmies(armies: readonly Army[], state: GameState): string {
  if (armies.length === 0) return "ARMIES(0): none";

  const lines = armies.map((a) => {
    const gen = state.generals.get(a.generalId);
    const genName = gen ? gen.name : a.generalId;
    const troops = `inf:${a.troops.infantry} cav:${a.troops.cavalry} arc:${a.troops.archer}`;
    return `  ${genName}@${hexKey(a.coord)} ${troops} [${a.state}]`;
  });
  return `ARMIES(${armies.length}):\n${lines.join("\n")}`;
}

function compactCities(cities: readonly City[]): string {
  const lines = cities.map((c) => {
    const cap = c.isCapital ? "*" : "";
    const garr = `gar:${c.garrison.infantry}/${c.garrison.cavalry}/${c.garrison.archer}`;
    const training = c.trainingQueue
      ? `train:${c.trainingQueue.troopType}(${c.trainingQueue.ticksRemaining}t)`
      : "train:-";
    return `  ${cap}${c.name}[${hexKey(c.coord)}] lv${c.level} walls:${c.walls} ${garr} ${training}`;
  });
  return `CITIES(${cities.length}):\n${lines.join("\n")}`;
}

function compactTech(techs: readonly string[]): string {
  const available = TECH_TREE.filter((t) => {
    if (techs.includes(t.id)) return false;
    return t.prerequisites.every((p) => techs.includes(p));
  });

  const avail = available
    .sort((a, b) => {
      const aCost = a.cost.gold + a.cost.food + a.cost.wood + a.cost.iron;
      const bCost = b.cost.gold + b.cost.food + b.cost.wood + b.cost.iron;
      return aCost - bCost;
    })
    .slice(0, 5)
    .map((t) => `${t.id}(${t.cost.gold}g)`)
    .join(" ");

  return `TECH known:[${techs.join(",")}] avail:[${avail}]`;
}

function compactThreats(
  state: GameState,
  factionId: FactionId,
  cities: readonly City[],
  armies: readonly Army[],
): string {
  const visible = computeVisibleHexes(cities, armies);
  const enemies: string[] = [];
  const enemyCities: string[] = [];

  // Collect enemy armies in vision
  const seenEnemies = new Map<string, { count: number; totalTroops: number; coord: string }>();
  for (const a of state.armies.values()) {
    if (a.factionId === factionId) continue;
    const key = hexKey(a.coord);
    if (!visible.has(key)) continue;
    const troopCount = a.troops.infantry + a.troops.cavalry + a.troops.archer;
    const existing = seenEnemies.get(key);
    if (existing) {
      existing.count++;
      existing.totalTroops += troopCount;
    } else {
      seenEnemies.set(key, { count: 1, totalTroops: troopCount, coord: key });
    }
  }

  for (const [, e] of seenEnemies) {
    enemies.push(`${e.count}army@${e.coord}(${e.totalTroops}troops)`);
  }

  // Collect enemy cities in vision
  for (const city of state.cities.values()) {
    if (city.factionId === factionId) continue;
    if (!visible.has(hexKey(city.coord))) continue;
    const owner = state.factions.get(city.factionId);
    enemyCities.push(`${city.name}[${hexKey(city.coord)}]${city.isCapital ? "*" : ""}(${owner?.name ?? city.factionId})`);
  }

  // Faction summary
  const factionSummary = [...state.factions.values()]
    .filter((f) => f.id !== factionId && f.alive)
    .map((f) => {
      const fc = [...state.cities.values()].filter((c) => c.factionId === f.id).length;
      const fa = [...state.armies.values()].filter((a) => a.factionId === f.id).length;
      return `${f.name}:${fc}c/${fa}a`;
    })
    .join(" ");

  const parts = [`ENEMIES: ${factionSummary}`];
  if (enemyCities.length > 0) parts.push(`  visible_cities: ${enemyCities.join(" ")}`);
  if (enemies.length > 0) parts.push(`  visible_armies: ${enemies.join(" ")}`);
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

// Static format block
const FORMAT_BLOCK = `ACT format JSON:
{"armies":[{"generalId":"ID","action":"march|attack|retreat|garrison|idle","target":{"q":0,"r":0}}],
"cities":[{"cityId":"ID","action":"train|upgrade_walls|upgrade_city|idle","troopType":"infantry|cavalry|archer","amount":100}],
"build":[{"hex":{"q":0,"r":0},"building":"farm|lumber_mill|mine|market|barracks|watchtower|fortress"}],
"research":"tech_id_or_null",
"diplomacy":[{"action":"declare_war|propose_alliance|offer_peace","targetFactionId":"faction_id"}]}
train costs: inf=${TROOP_STATS.infantry.trainCost.gold}g/${TROOP_STATS.infantry.trainCost.food}f cav=${TROOP_STATS.cavalry.trainCost.gold}g/${TROOP_STATS.cavalry.trainCost.food}f arc=${TROOP_STATS.archer.trainCost.gold}g/${TROOP_STATS.archer.trainCost.food}f
Trump: inf>cav>arc>inf. Armies march to target hex then battle.`;

// === Helpers ===

function getFactionCities(state: GameState, factionId: FactionId): City[] {
  return [...state.cities.values()].filter((c) => c.factionId === factionId);
}

function getFactionArmies(state: GameState, factionId: FactionId): Army[] {
  return [...state.armies.values()].filter((a) => a.factionId === factionId);
}

function getFactionGenerals(state: GameState, factionId: FactionId): General[] {
  return [...state.generals.values()].filter((g) => g.factionId === factionId);
}

function computeVisibleHexes(
  cities: readonly City[],
  armies: readonly Army[],
): Set<string> {
  const visible = new Set<string>();
  for (const city of cities) {
    for (const coord of hexDisk(city.coord, 2)) {
      visible.add(hexKey(coord));
    }
  }
  for (const army of armies) {
    for (const coord of hexDisk(army.coord, 2)) {
      visible.add(hexKey(coord));
    }
  }
  return visible;
}
