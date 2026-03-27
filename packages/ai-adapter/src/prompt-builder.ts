import type {
  GameState,
  FactionId,
  City,
  Army,
  General,
  GeneralDef,
  Tile,
  TerrainType,
} from "@xpoch/shared";
import {
  hexKey, hexDistance, hexDisk,
  TECH_TREE, TROOP_STATS, TRUMP_MAP, TRUMP_BONUS,
  TERRAIN_INCOME, TERRAIN_DEFENSE, TERRAIN_MOVEMENT_COST,
  BUILDING_DEFS, GENERAL_POOL,
  CAPITAL_DEFENSE, CITY_DEFENSE, WALL_DEFENSE_PER_LEVEL,
  FOOD_PER_100_TROOPS,
} from "@xpoch/shared";

const GENERAL_DEF_MAP = new Map<string, GeneralDef>(
  GENERAL_POOL.map((g) => [g.id, g]),
);

/**
 * Build a complete prompt with RULES + STATE + ACTIONS.
 * The AI receives full game rules so it can reason about strategy.
 */
export function buildPrompt(state: GameState, factionId: FactionId): string {
  const f = state.factions.get(factionId)!;
  const cities = getFactionCities(state, factionId);
  const armies = getFactionArmies(state, factionId);
  const generals = getFactionGenerals(state, factionId);
  const buildableTiles = getBuildableTiles(state, factionId);

  return [
    RULES_SECTION,
    "",
    "===== YOUR CURRENT STATE =====",
    "",
    compactStatus(f, state),
    compactGenerals(generals),
    compactArmies(armies, state),
    compactCities(cities),
    compactBuildable(buildableTiles),
    compactTech(f.techs),
    compactThreats(state, factionId, cities, armies),
    compactDiplomacy(state, factionId),
    "",
    "===== YOUR DECISION =====",
    buildResponseFormat(generals, cities, buildableTiles),
  ].join("\n");
}

// === GAME RULES (static, sent every turn) ===

const RULES_SECTION = `You are a commander in 率土争霸 (Three Kingdoms War). Win by destroying ALL enemy cities.

=== RULES ===

VICTORY: Destroy all enemy cities. Last faction standing wins.

TERRAIN:
  plains: +3food +1gold, defense 0, move cost 1
  forest: +2wood +1gold, defense +1, move cost 2
  mountain: +2iron +1gold, defense +2, move cost 3
  desert: +2gold, defense 0, move cost 1
  water: impassable

TERRITORY: Your armies expand territory by standing on neutral tiles adjacent to your land. Territory must connect back to your cities or it's lost.

TROOPS (rock-paper-scissors):
  infantry > cavalry > archer > infantry
  Trump bonus: ${TRUMP_BONUS}x damage when type advantage applies
  infantry: atk3 def4 spd1, costs ${TROOP_STATS.infantry.trainCost.gold}g/${TROOP_STATS.infantry.trainCost.food}f per 100
  cavalry:  atk4 def2 spd3, costs ${TROOP_STATS.cavalry.trainCost.gold}g/${TROOP_STATS.cavalry.trainCost.food}f per 100
  archer:   atk3 def2 spd1, costs ${TROOP_STATS.archer.trainCost.gold}g/${TROOP_STATS.archer.trainCost.food}f per 100
  Food upkeep: ${FOOD_PER_100_TROOPS} food per 100 troops per tick. Starvation = lose 10% troops.

COMBAT:
  power = troops × attack × (1 + general_bonus) × trump_bonus
  defense = troops × defense × (1 + general_bonus) × terrain_bonus
  City defense: capital +${CAPITAL_DEFENSE}, city +${CITY_DEFENSE}, per wall level +${WALL_DEFENSE_PER_LEVEL}
  Both sides take losses. Higher total power wins. Tie = defender wins.

GENERALS: Lead armies. Each has attack/defense bonuses and a unique skill. Dead generals respawn in 3 ticks (lose 1 level).

BUILDINGS: Built on your territory tiles.
  farm(plains): +5food | lumber_mill(forest): +3wood | mine(mountain): +3iron
  market(any land): +4gold | barracks(any): faster training
  watchtower(any): +2 vision | fortress(any): +5 defense

ACTIONS PER TICK:
  1. armies: march/attack/retreat/garrison/idle (one order per general)
  2. cities: train troops / upgrade walls / upgrade city / idle
  3. build: place buildings on your owned tiles
  4. research: learn one tech (costs resources)
  5. diplomacy: declare_war / propose_alliance / offer_peace

You decide your own strategy. Analyze the situation and act.`;

// === RESPONSE FORMAT ===

interface BuildableSummary {
  readonly terrain: TerrainType;
  readonly count: number;
  readonly building: string;
  readonly sampleHex: { readonly q: number; readonly r: number };
}

function buildResponseFormat(
  generals: readonly General[],
  cities: readonly City[],
  buildable: readonly BuildableSummary[],
): string {
  const genId = generals[0]?.id ?? "generalId";
  const cityId = cities[0]?.id ?? "cityId";
  const exampleBuild = buildable.find((b) => b.building === "farm" || b.building === "lumber_mill") ?? buildable[0];
  const buildJson = exampleBuild
    ? `{"hex":{"q":${exampleBuild.sampleHex.q},"r":${exampleBuild.sampleHex.r}},"building":"${exampleBuild.building}"}`
    : "";

  return `Respond with JSON ONLY, no explanation.
IMPORTANT: Use the exact IDs shown above. Do NOT use Chinese names as IDs.
IMPORTANT: Pick ONE action per entry. Do NOT write "march|attack" — choose one.
Example (adapt to your situation):
{"armies":[{"generalId":"${genId}","action":"march","target":{"q":1,"r":0}}],"cities":[{"cityId":"${cityId}","action":"train","troopType":"cavalry","amount":100}],"build":[${buildJson}],"research":"agriculture","diplomacy":[]}
Valid actions — armies: march, attack, retreat, garrison, idle | cities: train, upgrade_walls, upgrade_city, idle | troopType: infantry, cavalry, archer
/no_think`;
}

// === STATE SECTIONS ===

function compactStatus(f: any, state: GameState): string {
  const totalTroops = calculateTotalTroops(state, f.id);
  const foodPerTick = estimateFoodBalance(state, f.id);
  return `T${state.tick} | ${f.name} | 领地:${f.territoryCount} | 金:${f.resources.gold} 粮:${f.resources.food}(${foodPerTick >= 0 ? "+" : ""}${foodPerTick}/t) 木:${f.resources.wood} 铁:${f.resources.iron} | 兵:${totalTroops}`;
}

function compactGenerals(generals: readonly General[]): string {
  const lines = generals.map((g) => {
    const def = GENERAL_DEF_MAP.get(g.defId);
    const status = g.alive ? `Lv${g.level}` : `☠T${g.respawnTick}`;
    const skill = def?.skill.name ?? "?";
    const spec = def?.specialty ?? "all";
    const atk = def?.baseAttack ?? 0;
    const def2 = def?.baseDefense ?? 0;
    return `  ${g.name}[ID:${g.id}] ${spec} atk${atk}/def${def2} ${status} 技:${skill}`;
  });
  return `GENERALS(${generals.length}) — use the ID (e.g. "${generals[0]?.id ?? "xxx"}") in generalId field:\n${lines.join("\n")}`;
}

function compactArmies(armies: readonly Army[], state: GameState): string {
  if (armies.length === 0) return "ARMIES: none deployed";
  const lines = armies.map((a) => {
    const gen = state.generals.get(a.generalId);
    const total = a.troops.infantry + a.troops.cavalry + a.troops.archer;
    const marchInfo = a.state === "marching" && a.target
      ? ` →${hexKey(a.target)}`
      : "";
    return `  generalId:${a.generalId} (${gen?.name ?? "?"})@${hexKey(a.coord)} 步${a.troops.infantry}/骑${a.troops.cavalry}/弓${a.troops.archer}(${total}) [${a.state}${marchInfo}]`;
  });
  return `ARMIES(${armies.length}):\n${lines.join("\n")}`;
}

function compactCities(cities: readonly City[]): string {
  const lines = cities.map((c) => {
    const cap = c.isCapital ? "★" : "";
    const garTotal = c.garrison.infantry + c.garrison.cavalry + c.garrison.archer;
    const training = c.trainingQueue
      ? `训练:${c.trainingQueue.troopType}×${c.trainingQueue.amount}(${c.trainingQueue.ticksRemaining}t)`
      : "";
    return `  ${cap}${c.name}[ID:${c.id}]@${hexKey(c.coord)} Lv${c.level} 墙${c.walls} 驻军${garTotal}(步${c.garrison.infantry}/骑${c.garrison.cavalry}/弓${c.garrison.archer}) ${training}`;
  });
  return `CITIES(${cities.length}) — use the ID (e.g. "${cities[0]?.id ?? "xxx"}") in cityId field:\n${lines.join("\n")}`;
}

function compactTech(techs: readonly string[]): string {
  const available = TECH_TREE.filter((t) => {
    if (techs.includes(t.id)) return false;
    return t.prerequisites.every((p) => techs.includes(p));
  });
  const avail = available
    .slice(0, 5)
    .map((t) => `${t.id}(${t.cost.gold}g/${t.cost.iron}i) ${t.effects[0]}`)
    .join(" | ");
  return `TECH(${techs.length}): [${techs.join(",")}]\n  可研究: ${avail || "无"}`;
}

function compactThreats(
  state: GameState, factionId: FactionId, cities: readonly City[], armies: readonly Army[],
): string {
  const visible = computeVisibleHexes(cities, armies);
  const lines: string[] = [];

  // Enemy summary
  for (const f of state.factions.values()) {
    if (f.id === factionId || !f.alive) continue;
    const ec = [...state.cities.values()].filter((c) => c.factionId === f.id);
    const ea = [...state.armies.values()].filter((a) => a.factionId === f.id);
    let nearestDist = Infinity;
    for (const c of ec) {
      for (const mc of cities) {
        nearestDist = Math.min(nearestDist, hexDistance(c.coord, mc.coord));
      }
    }
    lines.push(`  ${f.name}: ${ec.length}城 ${ea.length}军 距离≈${nearestDist}格 领地${f.territoryCount}`);

    // Visible enemy armies
    for (const a of ea) {
      if (!visible.has(hexKey(a.coord))) continue;
      const total = a.troops.infantry + a.troops.cavalry + a.troops.archer;
      const gen = state.generals.get(a.generalId);
      lines.push(`    可见军队: ${gen?.name ?? "?"}@${hexKey(a.coord)} ${total}兵`);
    }
    // Visible enemy cities
    for (const c of ec) {
      if (!visible.has(hexKey(c.coord))) continue;
      const garTotal = c.garrison.infantry + c.garrison.cavalry + c.garrison.archer;
      lines.push(`    可见城池: ${c.name}@${hexKey(c.coord)} 墙${c.walls} 驻军${garTotal}`);
    }
  }

  return `ENEMIES:\n${lines.join("\n") || "  无可见敌人"}`;
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
  return rels.length > 0 ? `DIPLOMACY: ${rels.join(" ")}` : "DIPLOMACY: 无外交关系";
}

// === Buildable tiles ===

const TERRAIN_TO_BUILDING: ReadonlyMap<TerrainType, string> = new Map([
  ["plains", "farm"],
  ["forest", "lumber_mill"],
  ["mountain", "mine"],
  ["desert", "market"],
]);

function getBuildableTiles(
  state: GameState,
  factionId: FactionId,
): readonly BuildableSummary[] {
  const counts = new Map<TerrainType, { count: number; sampleHex: { q: number; r: number } }>();

  for (const tile of state.tiles.values()) {
    if (tile.owner !== factionId) continue;
    if (tile.building !== null) continue;
    if (tile.cityId !== null) continue;
    if (tile.terrain === "water") continue;

    const existing = counts.get(tile.terrain);
    if (existing) {
      counts.set(tile.terrain, { count: existing.count + 1, sampleHex: existing.sampleHex });
    } else {
      counts.set(tile.terrain, { count: 1, sampleHex: { q: tile.coord.q, r: tile.coord.r } });
    }
  }

  const result: BuildableSummary[] = [];
  for (const [terrain, data] of counts) {
    const building = TERRAIN_TO_BUILDING.get(terrain) ?? "market";
    result.push({ terrain, count: data.count, building, sampleHex: data.sampleHex });
  }
  return result;
}

function compactBuildable(buildable: readonly BuildableSummary[]): string {
  if (buildable.length === 0) return "BUILDABLE TILES: none";
  const lines = buildable.map((b) => {
    const def = BUILDING_DEFS[b.building as keyof typeof BUILDING_DEFS];
    const techNote = def?.requiresTech ? ` (needs tech:${def.requiresTech})` : "";
    return `  ${b.terrain}×${b.count} → build ${b.building}${techNote} (e.g. hex {"q":${b.sampleHex.q},"r":${b.sampleHex.r}})`;
  });
  return `BUILDABLE TILES (empty owned tiles where you can build):\n${lines.join("\n")}`;
}

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
function calculateTotalTroops(state: GameState, factionId: FactionId): number {
  let total = 0;
  for (const a of state.armies.values()) {
    if (a.factionId === factionId) total += a.troops.infantry + a.troops.cavalry + a.troops.archer;
  }
  for (const c of state.cities.values()) {
    if (c.factionId === factionId) total += c.garrison.infantry + c.garrison.cavalry + c.garrison.archer;
  }
  return total;
}
function estimateFoodBalance(state: GameState, factionId: FactionId): number {
  const totalTroops = calculateTotalTroops(state, factionId);
  const consumption = Math.ceil(totalTroops / 100) * FOOD_PER_100_TROOPS;
  // Rough income estimate
  let foodIncome = 0;
  for (const tile of state.tiles.values()) {
    if (tile.owner === factionId) {
      foodIncome += (TERRAIN_INCOME[tile.terrain]?.food ?? 0);
      if (tile.building && BUILDING_DEFS[tile.building]) {
        foodIncome += (BUILDING_DEFS[tile.building].income.food ?? 0);
      }
    }
  }
  return foodIncome - consumption;
}
function computeVisibleHexes(cities: readonly City[], armies: readonly Army[]): Set<string> {
  const visible = new Set<string>();
  for (const city of cities) {
    for (const coord of hexDisk(city.coord, 3)) visible.add(hexKey(coord));
  }
  for (const army of armies) {
    for (const coord of hexDisk(army.coord, 2)) visible.add(hexKey(coord));
  }
  return visible;
}
