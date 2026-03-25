import type {
  GameState,
  FactionId,
  City,
  Unit,
  Tile,
  HexCoord,
} from "@xpoch/shared";
import { hexKey, hexDistance, hexDisk, TECH_TREE, BUILDING_STATS } from "@xpoch/shared";

export function buildPrompt(state: GameState, factionId: FactionId): string {
  const faction = state.factions.get(factionId)!;

  const factionCities = getCitiesForFaction(state, factionId);
  const factionUnits = getUnitsForFaction(state, factionId);

  const foodBalance = computeFoodBalance(state, factionId);
  const researchInfo = computeResearchInfo(faction);

  const sections = [
    buildHeader(faction.name),
    buildStatus(faction, factionCities, factionUnits, foodBalance, researchInfo),
    buildCitiesSection(state, factionCities),
    buildUnitsSection(factionUnits),
    buildTechSection(faction),
    buildVisibleMapSection(state, factionId, factionCities, factionUnits),
    buildDiplomacySection(state, factionId),
    buildActionsSection(),
    buildResponseFormat(),
  ];

  return sections.join("\n\n");
}

// --- Section builders ---

function buildHeader(factionName: string): string {
  return `You are "${factionName}", commanding a civilization in a hex-based war game.
Your objective: DESTROY all enemy factions by capturing their cities.`;
}

function buildStatus(
  faction: ReturnType<ReadonlyMap<string, any>["get"]>,
  cities: readonly City[],
  units: readonly Unit[],
  foodBalance: number,
  researchInfo: { current: number; nextCost: number | null; nextName: string | null },
): string {
  const researchStr = researchInfo.nextCost !== null
    ? `${faction.research}/${researchInfo.nextCost} for ${researchInfo.nextName}`
    : `${faction.research} (no research queued)`;

  const balanceSign = foodBalance >= 0 ? "+" : "";

  return `## Your Status
- Gold: ${faction.gold} | Food: ${faction.food} (balance: ${balanceSign}${foodBalance}/turn) | Research: ${researchStr}
- Cities: ${cities.length} | Units: ${units.length} | Techs researched: ${faction.techs.length}`;
}

function buildCitiesSection(state: GameState, cities: readonly City[]): string {
  if (cities.length === 0) return "## Your Cities\n(none)";

  const lines = cities.map((city) => {
    const project = city.currentProject
      ? `building ${city.currentProject.target} (${city.currentProject.invested}/${city.currentProject.cost})`
      : "idle";

    const outskirtBuildings = getOutskirtBuildings(state, city.id);
    const buildingsStr = outskirtBuildings.length > 0
      ? outskirtBuildings.join(", ")
      : "none";

    return `- ${city.name} [${hexKey(city.coord)}] | production: ${city.production} | project: ${project} | buildings: ${buildingsStr}${city.isCapital ? " (CAPITAL)" : ""}`;
  });

  return `## Your Cities\n${lines.join("\n")}`;
}

function buildUnitsSection(units: readonly Unit[]): string {
  if (units.length === 0) return "## Your Units\n(none)";

  const lines = units.map((u) =>
    `- ${u.id}: ${u.type} | str: ${u.strength}/${u.maxStrength} | pos: ${hexKey(u.coord)} | moves: ${u.movement}/${u.maxMovement}`,
  );

  return `## Your Units\n${lines.join("\n")}`;
}

function buildTechSection(faction: { readonly techs: readonly string[]; readonly research: number }): string {
  const researched = faction.techs.length > 0
    ? faction.techs.join(", ")
    : "(none)";

  const available = TECH_TREE.filter((t) => {
    if (faction.techs.includes(t.id)) return false;
    return t.prerequisites.every((p) => faction.techs.includes(p));
  });

  const availableStr = available.length > 0
    ? available.map((t) => `- ${t.id}: ${t.name} (cost: ${t.cost}) — ${t.effects.join("; ")}`).join("\n")
    : "(none available)";

  return `## Your Technologies
Researched: ${researched}

Available to research:
${availableStr}`;
}

function buildVisibleMapSection(
  state: GameState,
  factionId: FactionId,
  cities: readonly City[],
  units: readonly Unit[],
): string {
  const visibleCoords = computeVisibleHexes(state, factionId, cities, units);
  const lines: string[] = [];

  for (const key of visibleCoords) {
    const tile = state.tiles.get(key);
    if (!tile) continue;

    const parts: string[] = [`${key}: ${tile.terrain}`];

    if (tile.naturalResource) {
      parts.push(`resource=${tile.naturalResource}`);
    }
    if (tile.building) {
      parts.push(`building=${tile.building}`);
    }

    // Show enemy units at this coord
    const enemyUnits = [...state.units.values()].filter(
      (u) => u.factionId !== factionId && hexKey(u.coord) === key,
    );
    if (enemyUnits.length > 0) {
      const unitDescs = enemyUnits.map((u) => `${u.type}(str:${u.strength})`);
      parts.push(`enemy_units=[${unitDescs.join(", ")}]`);
    }

    // Show enemy cities at this coord
    if (tile.cityId) {
      const city = state.cities.get(tile.cityId);
      if (city && city.factionId !== factionId) {
        parts.push(`enemy_city=${city.name}(${city.factionId})`);
      }
    }

    if (tile.owner && tile.owner !== factionId) {
      parts.push(`owner=${tile.owner}`);
    }

    lines.push(`  ${parts.join(" | ")}`);
  }

  return `## Visible Map\n${lines.length > 0 ? lines.join("\n") : "  (no visible tiles)"}`;
}

function buildDiplomacySection(state: GameState, factionId: FactionId): string {
  const lines: string[] = [];

  for (const [key, status] of state.diplomacy.relations) {
    const [a, b] = key.split(":");
    if (a === factionId || b === factionId) {
      const otherId = a === factionId ? b : a;
      const otherFaction = state.factions.get(otherId);
      lines.push(`  ${otherFaction?.name ?? otherId}: ${status}`);
    }
  }

  return `## Diplomacy\n${lines.length > 0 ? lines.join("\n") : "  (no diplomatic relations)"}`;
}

function buildActionsSection(): string {
  return `## Available Actions

### Military Orders (for each unit):
- move: {"unit_id": "...", "action": "move", "to": "q,r"}
- attack: {"unit_id": "...", "action": "attack", "to": "q,r"}
- fortify: {"unit_id": "...", "action": "fortify"}
- disband: {"unit_id": "...", "action": "disband"}

### City Orders (for each city):
- train: {"city_id": "...", "action": "train", "unit_type": "infantry|cavalry|artillery|settler|scout"}
- build: {"city_id": "...", "action": "build", "building": "...", "hex": "q,r"}
- rush: {"city_id": "...", "action": "rush"} (spend gold to finish current project)
- idle: {"city_id": "...", "action": "idle"}

### Research:
- "tech_id" or null

### Diplomacy:
- {"action": "declare_war|propose_alliance|break_alliance|offer_peace|demand_tribute|send_gold", "target": "faction_id"}`;
}

function buildResponseFormat(): string {
  return `Respond with JSON only:
{
  "military": [...],
  "cities": [...],
  "research": "tech_id_or_null",
  "diplomacy": [...]
}`;
}

// --- Helpers ---

function getCitiesForFaction(state: GameState, factionId: FactionId): City[] {
  return [...state.cities.values()].filter((c) => c.factionId === factionId);
}

function getUnitsForFaction(state: GameState, factionId: FactionId): Unit[] {
  return [...state.units.values()].filter((u) => u.factionId === factionId);
}

function computeFoodBalance(state: GameState, factionId: FactionId): number {
  const unitCount = [...state.units.values()].filter(
    (u) => u.factionId === factionId,
  ).length;

  // Each city tile with granary adds food; base food from cities
  const cityCount = [...state.cities.values()].filter(
    (c) => c.factionId === factionId,
  ).length;

  // Simplified: each city produces 2 food base, minus 1 per unit
  return cityCount * 2 - unitCount;
}

function computeResearchInfo(faction: {
  readonly techs: readonly string[];
  readonly research: number;
}): { current: number; nextCost: number | null; nextName: string | null } {
  const available = TECH_TREE.filter((t) => {
    if (faction.techs.includes(t.id)) return false;
    return t.prerequisites.every((p) => faction.techs.includes(p));
  });

  if (available.length === 0) {
    return { current: faction.research, nextCost: null, nextName: null };
  }

  // Show cheapest available as reference
  const cheapest = available.reduce((a, b) => (a.cost < b.cost ? a : b));
  return { current: faction.research, nextCost: cheapest.cost, nextName: cheapest.name };
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
  state: GameState,
  factionId: FactionId,
  cities: readonly City[],
  units: readonly Unit[],
): Set<string> {
  const visible = new Set<string>();
  const visionRange = 2;

  // Cities give vision
  for (const city of cities) {
    for (const coord of hexDisk(city.coord, visionRange)) {
      visible.add(hexKey(coord));
    }
  }

  // Units give vision
  for (const unit of units) {
    const range = unit.type === "scout" ? visionRange + 1 : visionRange;
    for (const coord of hexDisk(unit.coord, range)) {
      visible.add(hexKey(coord));
    }
  }

  return visible;
}
