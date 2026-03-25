// === Hex Grid ===

export interface HexCoord {
  readonly q: number;
  readonly r: number;
}

// === Terrain ===

export type TerrainType = "plains" | "forest" | "mountain" | "water" | "desert";

export type NaturalResource = "iron" | "horses" | "saltpeter" | "oil" | null;

export interface Tile {
  readonly coord: HexCoord;
  readonly terrain: TerrainType;
  readonly owner: FactionId | null;
  readonly naturalResource: NaturalResource;
  readonly building: BuildingType | null;
  readonly cityId: CityId | null; // non-null if this tile IS a city center
  readonly isCityOutskirt: CityId | null; // non-null if within a city's outskirts
}

// === Units ===

export type UnitType = "infantry" | "cavalry" | "artillery" | "settler" | "scout";

export interface Unit {
  readonly id: string;
  readonly factionId: FactionId;
  readonly type: UnitType;
  readonly coord: HexCoord;
  readonly strength: number;
  readonly maxStrength: number;
  readonly movement: number;
  readonly maxMovement: number;
  readonly upgraded: boolean; // has been upgraded by tech
}

// Trump relationships: infantry > cavalry > artillery > infantry
export type TrumpMap = Record<UnitType, UnitType | null>;

// === Cities ===

export type CityId = string;

export interface City {
  readonly id: CityId;
  readonly factionId: FactionId;
  readonly name: string;
  readonly coord: HexCoord;
  readonly isCapital: boolean;
  readonly hasWalls: boolean;
  readonly production: number; // accumulated production points
  readonly currentProject: ProductionProject | null;
}

export interface ProductionProject {
  readonly type: "unit" | "building" | "wonder";
  readonly target: string; // unit type, building type, or wonder id
  readonly invested: number;
  readonly cost: number;
}

// === Buildings ===

export type BuildingType =
  | "granary"
  | "barracks"
  | "workshop"
  | "market"
  | "library"
  | "city_walls"
  | "harbor"
  | "fortress"
  | "factory"
  | "airport";

// === Tech ===

export type TechId = string;
export type TechEra = "ancient" | "classical" | "medieval" | "industrial" | "modern";

export interface Tech {
  readonly id: TechId;
  readonly name: string;
  readonly era: TechEra;
  readonly cost: number;
  readonly prerequisites: readonly TechId[];
  readonly effects: readonly string[]; // human-readable descriptions for AI prompt
}

// === Wonders ===

export type WonderId = string;

export interface Wonder {
  readonly id: WonderId;
  readonly name: string;
  readonly era: TechEra;
  readonly cost: number;
  readonly effect: string;
  readonly builtBy: FactionId | null; // null = not yet built
  readonly cityId: CityId | null;
}

// === Factions ===

export type FactionId = string;

export interface Faction {
  readonly id: FactionId;
  readonly name: string;
  readonly modelProvider: string;
  readonly color: string;
  readonly gold: number;
  readonly food: number;
  readonly storedFood: number; // excess food (max 20)
  readonly research: number; // accumulated research points
  readonly techs: readonly TechId[]; // researched tech ids
  readonly alive: boolean;
  readonly controlledResources: readonly NaturalResource[]; // from tiles with resources
}

// === Diplomacy ===

export type DiplomaticStatus = "neutral" | "allied" | "war" | "peace";

export interface DiplomacyState {
  readonly relations: ReadonlyMap<string, DiplomaticStatus>; // key: "factionA:factionB"
}

// === Actions (AI decisions per tick) ===

export interface TurnDecision {
  readonly factionId: FactionId;
  readonly military: readonly MilitaryOrder[];
  readonly cities: readonly CityOrder[];
  readonly research: TechId | null;
  readonly diplomacy: readonly DiplomacyOrder[];
}

export interface MilitaryOrder {
  readonly unitId: string;
  readonly action: "move" | "attack" | "fortify" | "disband";
  readonly to?: HexCoord;
}

export interface CityOrder {
  readonly cityId: CityId;
  readonly action: "train" | "build" | "rush" | "idle";
  readonly target?: string; // unit type, building type, or wonder id
  readonly hex?: HexCoord; // for building placement
}

export interface DiplomacyOrder {
  readonly action: "declare_war" | "propose_alliance" | "break_alliance" | "offer_peace" | "demand_tribute" | "send_gold";
  readonly targetFactionId: FactionId;
  readonly amount?: number; // for send_gold / demand_tribute
}

// === Game State ===

export interface GameState {
  readonly tick: number;
  readonly tiles: ReadonlyMap<string, Tile>;
  readonly units: ReadonlyMap<string, Unit>; // key: unit id
  readonly cities: ReadonlyMap<CityId, City>;
  readonly factions: ReadonlyMap<FactionId, Faction>;
  readonly wonders: readonly Wonder[];
  readonly diplomacy: DiplomacyState;
  readonly log: readonly LogEntry[];
  readonly winner: FactionId | null;
  readonly mapSize: number;
}

export interface LogEntry {
  readonly tick: number;
  readonly message: string;
  readonly category: "combat" | "diplomacy" | "economy" | "tech" | "city" | "system";
  readonly involvedFactions: readonly FactionId[];
}

// === AI Adapter ===

export interface AIAdapter {
  readonly providerId: string;
  decideActions(state: GameState, factionId: FactionId): Promise<TurnDecision>;
}

// === Server Messages ===

export type ServerMessage =
  | { type: "state_update"; state: GameState }
  | { type: "log_entry"; entry: LogEntry }
  | { type: "game_over"; winnerId: FactionId | null };

export type ClientMessage =
  | { type: "subscribe"; sessionId: string }
  | { type: "unsubscribe" };
