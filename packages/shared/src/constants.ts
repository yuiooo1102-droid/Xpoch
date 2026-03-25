export const MAP_SIZE = 10; // radius in hex rings (creates ~20x20 playable area)

export const FACTION_COLORS: Record<string, string> = {
  claude: "#8B5CF6",  // purple
  openai: "#10B981",  // green
  gemini: "#3B82F6",  // blue
  deepseek: "#F59E0B", // yellow
  mock: "#EF4444",    // red
};

export const TERRAIN_RESOURCES: Record<string, number> = {
  plains: 2,
  forest: 1,
  mountain: 0,
  water: 0,
  desert: 1,
};

export const TERRAIN_MOVEMENT_COST: Record<string, number> = {
  plains: 1,
  forest: 2,
  mountain: 3,
  water: Infinity,
  desert: 2,
};

export const RECRUIT_COST = 10;     // gold per unit
export const FOOD_PER_UNIT = 1;     // food consumed per unit per tick
export const BASE_GOLD_PER_TILE = 1;
export const MAX_ACTIONS_PER_TURN = 3;
export const TICK_INTERVAL_MS = 5000; // 5 seconds per tick
