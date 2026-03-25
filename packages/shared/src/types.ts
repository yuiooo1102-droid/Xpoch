// --- Hex Grid ---
export interface HexCoord {
  readonly q: number;
  readonly r: number;
}

export type TerrainType = "plains" | "forest" | "mountain" | "water" | "desert";

export interface Tile {
  readonly coord: HexCoord;
  readonly terrain: TerrainType;
  readonly owner: FactionId | null;
  readonly army: number;
  readonly resources: number;
}

// --- Factions ---
export type FactionId = string;

export interface Faction {
  readonly id: FactionId;
  readonly name: string;
  readonly modelProvider: string; // "claude" | "openai" | "gemini" | "mock"
  readonly color: string;
  readonly gold: number;
  readonly food: number;
  readonly alive: boolean;
}

// --- Diplomacy ---
export type DiplomaticStatus = "neutral" | "allied" | "war";

export interface DiplomacyState {
  readonly relations: ReadonlyMap<string, DiplomaticStatus>; // key: "factionA:factionB"
}

// --- Actions ---
export type ActionType = "move" | "attack" | "recruit" | "propose_alliance" | "break_alliance" | "declare_war" | "trade" | "pass";

export interface Action {
  readonly factionId: FactionId;
  readonly type: ActionType;
  readonly from?: HexCoord;
  readonly to?: HexCoord;
  readonly amount?: number;
  readonly targetFactionId?: FactionId;
}

// --- Game State ---
export interface GameState {
  readonly tick: number;
  readonly tiles: ReadonlyMap<string, Tile>; // key: "q,r"
  readonly factions: ReadonlyMap<FactionId, Faction>;
  readonly diplomacy: DiplomacyState;
  readonly log: readonly LogEntry[];
  readonly winner: FactionId | null;
  readonly mapSize: number;
}

export interface LogEntry {
  readonly tick: number;
  readonly message: string;
  readonly involvedFactions: readonly FactionId[];
}

// --- AI Adapter ---
export interface AIAdapter {
  readonly providerId: string;
  decideActions(state: GameState, factionId: FactionId): Promise<Action[]>;
}

// --- Server Messages ---
export type ServerMessage =
  | { type: "state_update"; state: GameState }
  | { type: "log_entry"; entry: LogEntry }
  | { type: "game_over"; winnerId: FactionId | null };

export type ClientMessage =
  | { type: "subscribe"; sessionId: string }
  | { type: "unsubscribe" };
