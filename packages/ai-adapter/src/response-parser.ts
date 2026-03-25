import type {
  TurnDecision,
  FactionId,
  MilitaryOrder,
  CityOrder,
  DiplomacyOrder,
  HexCoord,
} from "@xpoch/shared";

interface RawMilitaryOrder {
  unit_id?: string;
  unitId?: string;
  action?: string;
  to?: string;
}

interface RawCityOrder {
  city_id?: string;
  cityId?: string;
  action?: string;
  unit_type?: string;
  unitType?: string;
  target?: string;
  building?: string;
  hex?: string;
}

interface RawDiplomacyOrder {
  action?: string;
  target?: string;
  targetFactionId?: string;
  amount?: number;
}

interface RawTurnDecision {
  military?: readonly RawMilitaryOrder[];
  cities?: readonly RawCityOrder[];
  research?: string | null;
  diplomacy?: readonly RawDiplomacyOrder[];
}

const VALID_MILITARY_ACTIONS = new Set(["move", "attack", "fortify", "disband"]);
const VALID_CITY_ACTIONS = new Set(["train", "build", "rush", "idle"]);
const VALID_DIPLOMACY_ACTIONS = new Set([
  "declare_war",
  "propose_alliance",
  "break_alliance",
  "offer_peace",
  "demand_tribute",
  "send_gold",
]);

export function parseAIResponse(
  raw: string,
  factionId: FactionId,
): TurnDecision {
  const passDecision: TurnDecision = {
    factionId,
    military: [],
    cities: [],
    research: null,
    diplomacy: [],
  };

  try {
    const cleaned = stripMarkdownFences(raw);
    const parsed: RawTurnDecision = JSON.parse(cleaned);

    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return passDecision;
    }

    const military = parseMilitaryOrders(parsed.military);
    const cities = parseCityOrders(parsed.cities);
    const research = typeof parsed.research === "string" ? parsed.research : null;
    const diplomacy = parseDiplomacyOrders(parsed.diplomacy);

    return { factionId, military, cities, research, diplomacy };
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

function parseMilitaryOrders(
  raw: readonly RawMilitaryOrder[] | undefined,
): readonly MilitaryOrder[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map(parseSingleMilitaryOrder)
    .filter((o): o is MilitaryOrder => o !== null);
}

function parseSingleMilitaryOrder(raw: RawMilitaryOrder): MilitaryOrder | null {
  const unitId = raw.unit_id ?? raw.unitId;
  if (!unitId || typeof unitId !== "string") return null;

  const action = raw.action;
  if (!action || !VALID_MILITARY_ACTIONS.has(action)) return null;

  const to = raw.to ? parseHexCoord(raw.to) : undefined;

  return {
    unitId,
    action: action as MilitaryOrder["action"],
    ...(to !== undefined ? { to } : {}),
  };
}

function parseCityOrders(
  raw: readonly RawCityOrder[] | undefined,
): readonly CityOrder[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map(parseSingleCityOrder)
    .filter((o): o is CityOrder => o !== null);
}

function parseSingleCityOrder(raw: RawCityOrder): CityOrder | null {
  const cityId = raw.city_id ?? raw.cityId;
  if (!cityId || typeof cityId !== "string") return null;

  const action = raw.action;
  if (!action || !VALID_CITY_ACTIONS.has(action)) return null;

  const target = raw.unit_type ?? raw.unitType ?? raw.building ?? raw.target;
  const hex = raw.hex ? parseHexCoord(raw.hex) : undefined;

  return {
    cityId,
    action: action as CityOrder["action"],
    ...(target !== undefined ? { target } : {}),
    ...(hex !== undefined ? { hex } : {}),
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

  const targetFactionId = raw.target ?? raw.targetFactionId;
  if (!targetFactionId || typeof targetFactionId !== "string") return null;

  return {
    action: action as DiplomacyOrder["action"],
    targetFactionId,
    ...(raw.amount !== undefined ? { amount: raw.amount } : {}),
  };
}

function parseHexCoord(s: string): HexCoord | undefined {
  const parts = s.split(",").map((p) => p.trim());
  if (parts.length !== 2) return undefined;

  const q = Number(parts[0]);
  const r = Number(parts[1]);

  if (Number.isNaN(q) || Number.isNaN(r)) return undefined;

  return { q, r };
}
