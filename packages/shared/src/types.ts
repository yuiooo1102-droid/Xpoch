// === Hex Grid ===

export interface HexCoord {
  readonly q: number;
  readonly r: number;
}

// === Terrain ===

export type TerrainType = "plains" | "forest" | "mountain" | "water" | "desert";

export interface Tile {
  readonly coord: HexCoord;
  readonly terrain: TerrainType;
  readonly owner: FactionId | null;
  readonly building: BuildingType | null;
  readonly cityId: CityId | null;
}

// === Resources ===

export interface Resources {
  readonly gold: number;
  readonly food: number;
  readonly wood: number;
  readonly iron: number;
}

// === Troop Types (三角克制) ===

export type TroopType = "infantry" | "cavalry" | "archer";

export interface Troops {
  readonly infantry: number;
  readonly cavalry: number;
  readonly archer: number;
}

// === Generals (将领) ===

export type GeneralId = string;
export type GeneralSkillType = "passive" | "active";

export interface GeneralSkill {
  readonly name: string;
  readonly type: GeneralSkillType;
  readonly description: string;
}

export type HistoricalFaction = "shu" | "wei" | "wu" | "neutral";

export interface GeneralDef {
  readonly id: GeneralId;
  readonly name: string;
  readonly specialty: TroopType | "all";
  readonly baseAttack: number;
  readonly baseDefense: number;
  readonly baseSpeed: number;
  readonly skill: GeneralSkill;
  readonly historicalFaction: HistoricalFaction;
}

export interface General {
  readonly id: GeneralId;
  readonly defId: GeneralId; // reference to GeneralDef
  readonly factionId: FactionId;
  readonly name: string;
  readonly level: number;
  readonly exp: number;
  readonly alive: boolean;
  readonly respawnTick: number | null; // tick when available again (null = available)
}

// === Armies (将领 + 兵力) ===

export type ArmyId = string;

export interface Army {
  readonly id: ArmyId;
  readonly factionId: FactionId;
  readonly generalId: GeneralId;
  readonly troops: Troops;
  readonly coord: HexCoord;
  readonly target: HexCoord | null; // marching destination (null = stationary)
  readonly state: "idle" | "marching" | "battling" | "returning";
}

// === Cities ===

export type CityId = string;

export interface City {
  readonly id: CityId;
  readonly factionId: FactionId;
  readonly name: string;
  readonly coord: HexCoord;
  readonly isCapital: boolean;
  readonly level: number; // 1-5, affects production
  readonly walls: number; // 0-3, defense bonus
  readonly garrison: Troops; // troops defending the city (no general needed)
  readonly trainingQueue: TrainingOrder | null;
}

export interface TrainingOrder {
  readonly troopType: TroopType;
  readonly amount: number;
  readonly ticksRemaining: number;
}

// === Buildings ===

export type BuildingType =
  | "farm"        // +food on plains
  | "lumber_mill" // +wood on forest
  | "mine"        // +iron on mountain
  | "market"      // +gold anywhere
  | "barracks"    // train speed bonus
  | "watchtower"  // +vision range
  | "fortress";   // +defense on this tile

// === Tech ===

export type TechId = string;

export interface Tech {
  readonly id: TechId;
  readonly name: string;
  readonly cost: Resources;
  readonly prerequisites: readonly TechId[];
  readonly effects: readonly string[];
}

// === Factions ===

export type FactionId = string;

export interface Faction {
  readonly id: FactionId;
  readonly name: string;
  readonly modelProvider: string;
  readonly color: string;
  readonly resources: Resources;
  readonly techs: readonly TechId[];
  readonly alive: boolean;
  readonly territoryCount: number; // cached count of owned tiles
}

// === Diplomacy ===

export type DiplomaticStatus = "neutral" | "allied" | "war" | "peace";

export interface DiplomacyState {
  readonly relations: ReadonlyMap<string, DiplomaticStatus>;
}

// === AI Decision (每 tick) ===

export interface TurnDecision {
  readonly factionId: FactionId;
  readonly armies: readonly ArmyOrder[];
  readonly cities: readonly CityOrder[];
  readonly research: TechId | null;
  readonly build: readonly BuildOrder[];
  readonly diplomacy: readonly DiplomacyOrder[];
}

export interface ArmyOrder {
  readonly generalId: GeneralId;
  readonly action: "march" | "attack" | "retreat" | "garrison" | "idle";
  readonly target?: HexCoord;
  readonly troops?: Partial<Troops>; // for new deployments
}

export interface CityOrder {
  readonly cityId: CityId;
  readonly action: "train" | "upgrade_walls" | "upgrade_city" | "idle";
  readonly troopType?: TroopType;
  readonly amount?: number;
}

export interface BuildOrder {
  readonly hex: HexCoord;
  readonly building: BuildingType;
}

export interface DiplomacyOrder {
  readonly action: "declare_war" | "propose_alliance" | "break_alliance" | "offer_peace" | "send_tribute";
  readonly targetFactionId: FactionId;
  readonly amount?: number;
}

// === Game State ===

export interface GameState {
  readonly tick: number;
  readonly tiles: ReadonlyMap<string, Tile>;
  readonly armies: ReadonlyMap<ArmyId, Army>;
  readonly generals: ReadonlyMap<GeneralId, General>;
  readonly cities: ReadonlyMap<CityId, City>;
  readonly factions: ReadonlyMap<FactionId, Faction>;
  readonly diplomacy: DiplomacyState;
  readonly log: readonly LogEntry[];
  readonly winner: FactionId | null;
  readonly mapSize: number;
}

export interface LogEntry {
  readonly tick: number;
  readonly message: string;
  readonly category: "combat" | "diplomacy" | "economy" | "tech" | "city" | "territory" | "system";
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
