import type {
  TurnDecision,
  FactionId,
  ArmyOrder,
  CityOrder,
  BuildOrder,
  DiplomacyOrder,
  HexCoord,
  TroopType,
  GameState,
} from "@xpoch/shared";
import { GENERAL_POOL } from "@xpoch/shared";

interface RawArmyOrder {
  general_id?: string;
  generalId?: string;
  action?: string;
  target?: { q?: number; r?: number } | string;
  troops?: { infantry?: number; cavalry?: number; archer?: number };
}

interface RawCityOrder {
  city_id?: string;
  cityId?: string;
  action?: string;
  troop_type?: string;
  troopType?: string;
  amount?: number;
}

interface RawBuildOrder {
  hex?: { q?: number; r?: number } | string;
  building?: string;
}

interface RawDiplomacyOrder {
  action?: string;
  target?: string;
  targetFactionId?: string;
  target_faction_id?: string;
  amount?: number;
}

interface RawTurnDecision {
  armies?: readonly RawArmyOrder[];
  cities?: readonly RawCityOrder[];
  build?: readonly RawBuildOrder[];
  research?: string | null;
  diplomacy?: readonly RawDiplomacyOrder[];
}

/** Map Chinese general names to their IDs for fallback resolution */
const GENERAL_NAME_TO_ID = new Map<string, string>(
  GENERAL_POOL.map((g) => [g.name, g.id]),
);

/** Resolve a generalId that might be a Chinese name to the actual ID */
function resolveGeneralId(raw: string): string {
  return GENERAL_NAME_TO_ID.get(raw) ?? raw;
}

/** Build a city name → ID map from the current game state */
function buildCityNameMap(state: GameState | undefined): ReadonlyMap<string, string> {
  if (!state) return new Map();
  const map = new Map<string, string>();
  for (const city of state.cities.values()) {
    map.set(city.name, city.id);
  }
  return map;
}

const VALID_ARMY_ACTIONS = new Set(["march", "attack", "retreat", "garrison", "idle"]);
const VALID_CITY_ACTIONS = new Set(["train", "upgrade_walls", "upgrade_city", "idle"]);
const VALID_DIPLOMACY_ACTIONS = new Set([
  "declare_war",
  "propose_alliance",
  "break_alliance",
  "offer_peace",
  "send_tribute",
]);
const VALID_TROOP_TYPES = new Set(["infantry", "cavalry", "archer"]);
const VALID_BUILDINGS = new Set([
  "farm", "lumber_mill", "mine", "market", "barracks", "watchtower", "fortress",
]);

export function parseAIResponse(
  raw: string,
  factionId: FactionId,
  state?: GameState,
): TurnDecision {
  const passDecision: TurnDecision = {
    factionId,
    armies: [],
    cities: [],
    build: [],
    research: null,
    diplomacy: [],
  };

  try {
    const cleaned = stripMarkdownFences(raw);
    const parsed: RawTurnDecision = JSON.parse(cleaned);

    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return passDecision;
    }

    const cityNameMap = buildCityNameMap(state);
    const armies = parseArmyOrders(parsed.armies);
    const cities = parseCityOrders(parsed.cities, cityNameMap);
    const build = parseBuildOrders(parsed.build);
    const research = typeof parsed.research === "string" ? parsed.research : null;
    const diplomacy = parseDiplomacyOrders(parsed.diplomacy);

    return { factionId, armies, cities, build, research, diplomacy };
  } catch {
    return passDecision;
  }
}

function stripMarkdownFences(raw: string): string {
  return raw
    .replace(/```json\s*/g, "")
    .replace(/```\s*/g, "")
    .trim();
}

function parseArmyOrders(
  raw: readonly RawArmyOrder[] | undefined,
): readonly ArmyOrder[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map(parseSingleArmyOrder)
    .filter((o): o is ArmyOrder => o !== null);
}

function parseSingleArmyOrder(raw: RawArmyOrder): ArmyOrder | null {
  const rawGeneralId = raw.general_id ?? raw.generalId;
  if (!rawGeneralId || typeof rawGeneralId !== "string") return null;

  const generalId = resolveGeneralId(rawGeneralId);

  const action = raw.action;
  if (!action || !VALID_ARMY_ACTIONS.has(action)) return null;

  const target = raw.target ? parseHexCoordFlexible(raw.target) : undefined;

  return {
    generalId,
    action: action as ArmyOrder["action"],
    ...(target !== undefined ? { target } : {}),
  };
}

function parseCityOrders(
  raw: readonly RawCityOrder[] | undefined,
  cityNameMap: ReadonlyMap<string, string>,
): readonly CityOrder[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((o) => parseSingleCityOrder(o, cityNameMap))
    .filter((o): o is CityOrder => o !== null);
}

function parseSingleCityOrder(
  raw: RawCityOrder,
  cityNameMap: ReadonlyMap<string, string>,
): CityOrder | null {
  const rawCityId = raw.city_id ?? raw.cityId;
  if (!rawCityId || typeof rawCityId !== "string") return null;
  // Fallback: if rawCityId is a Chinese city name, resolve to actual ID
  const cityId = cityNameMap.get(rawCityId) ?? rawCityId;

  const action = raw.action;
  if (!action || !VALID_CITY_ACTIONS.has(action)) return null;

  const troopType = raw.troop_type ?? raw.troopType;
  const validTroopType = troopType && VALID_TROOP_TYPES.has(troopType)
    ? troopType as TroopType
    : undefined;

  return {
    cityId,
    action: action as CityOrder["action"],
    ...(validTroopType !== undefined ? { troopType: validTroopType } : {}),
    ...(raw.amount !== undefined ? { amount: raw.amount } : {}),
  };
}

function parseBuildOrders(
  raw: readonly RawBuildOrder[] | undefined,
): readonly BuildOrder[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map(parseSingleBuildOrder)
    .filter((o): o is BuildOrder => o !== null);
}

function parseSingleBuildOrder(raw: RawBuildOrder): BuildOrder | null {
  const hex = raw.hex ? parseHexCoordFlexible(raw.hex) : undefined;
  if (!hex) return null;

  const building = raw.building;
  if (!building || !VALID_BUILDINGS.has(building)) return null;

  return {
    hex,
    building: building as BuildOrder["building"],
  };
}

function parseDiplomacyOrders(
  raw: readonly RawDiplomacyOrder[] | undefined,
): readonly DiplomacyOrder[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map(parseSingleDiplomacyOrder)
    .filter((o): o is DiplomacyOrder => o !== null);
}

function parseSingleDiplomacyOrder(raw: RawDiplomacyOrder): DiplomacyOrder | null {
  const action = raw.action;
  if (!action || !VALID_DIPLOMACY_ACTIONS.has(action)) return null;

  const targetFactionId = raw.target ?? raw.targetFactionId ?? raw.target_faction_id;
  if (!targetFactionId || typeof targetFactionId !== "string") return null;

  return {
    action: action as DiplomacyOrder["action"],
    targetFactionId,
    ...(raw.amount !== undefined ? { amount: raw.amount } : {}),
  };
}

function parseHexCoordFlexible(input: { q?: number; r?: number } | string): HexCoord | undefined {
  if (typeof input === "string") {
    const parts = input.split(",").map((p) => p.trim());
    if (parts.length !== 2) return undefined;
    const q = Number(parts[0]);
    const r = Number(parts[1]);
    if (Number.isNaN(q) || Number.isNaN(r)) return undefined;
    return { q, r };
  }

  if (typeof input === "object" && input !== null) {
    const q = input.q;
    const r = input.r;
    if (typeof q !== "number" || typeof r !== "number") return undefined;
    if (Number.isNaN(q) || Number.isNaN(r)) return undefined;
    return { q, r };
  }

  return undefined;
}
