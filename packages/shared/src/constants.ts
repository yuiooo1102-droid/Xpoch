import type { TerrainType, TroopType, BuildingType, GeneralDef, Resources } from "./types";

// === Map ===
export const MAP_SIZE = 12;

// === Terrain Resources per tick ===
export const TERRAIN_INCOME: Record<TerrainType, Partial<Resources>> = {
  plains: { food: 2, gold: 1 },
  forest: { wood: 2, gold: 1 },
  mountain: { iron: 2, gold: 1 },
  desert: { gold: 2 },
  water: {},
};

export const TERRAIN_DEFENSE: Record<TerrainType, number> = {
  plains: 0,
  forest: 1,
  mountain: 2,
  water: 0,
  desert: 0,
};

export const TERRAIN_MOVEMENT_COST: Record<TerrainType, number> = {
  plains: 1,
  forest: 2,
  mountain: 3,
  water: Infinity,
  desert: 1,
};

// === Troop Stats ===
export interface TroopStats {
  readonly attack: number;
  readonly defense: number;
  readonly speed: number;
  readonly foodCost: number; // per 100 troops per tick
  readonly trainCost: Resources; // per 100 troops
  readonly trainTicks: number; // per 100 troops
}

export const TROOP_STATS: Record<TroopType, TroopStats> = {
  infantry: {
    attack: 3, defense: 4, speed: 1, foodCost: 1,
    trainCost: { gold: 2, food: 3, wood: 1, iron: 0 },
    trainTicks: 1,
  },
  cavalry: {
    attack: 4, defense: 2, speed: 3, foodCost: 2,
    trainCost: { gold: 4, food: 4, wood: 0, iron: 2 },
    trainTicks: 2,
  },
  archer: {
    attack: 3, defense: 2, speed: 1, foodCost: 1,
    trainCost: { gold: 3, food: 2, wood: 3, iron: 0 },
    trainTicks: 1,
  },
};

// === Trump (克制) ===
// Infantry > Cavalry > Archer > Infantry
export const TRUMP_MAP: Record<TroopType, TroopType> = {
  infantry: "cavalry",
  cavalry: "archer",
  archer: "infantry",
};
export const TRUMP_BONUS = 1.3; // 30% damage bonus when trumping

// === General Pool ===
export const GENERAL_POOL: readonly GeneralDef[] = [
  { id: "lubu", name: "吕布", specialty: "cavalry", baseAttack: 9, baseDefense: 5, baseSpeed: 3, skill: { name: "无双", type: "passive", description: "攻击+30%" } },
  { id: "zhuge", name: "诸葛亮", specialty: "archer", baseAttack: 7, baseDefense: 6, baseSpeed: 2, skill: { name: "火攻", type: "active", description: "对目标格额外30%伤害" } },
  { id: "guanyu", name: "关羽", specialty: "infantry", baseAttack: 8, baseDefense: 8, baseSpeed: 2, skill: { name: "武圣", type: "passive", description: "防御+30%" } },
  { id: "zhaoyn", name: "赵云", specialty: "cavalry", baseAttack: 8, baseDefense: 6, baseSpeed: 3, skill: { name: "龙胆", type: "passive", description: "速度+1, 首回合双倍伤害" } },
  { id: "caocao", name: "曹操", specialty: "all", baseAttack: 7, baseDefense: 7, baseSpeed: 2, skill: { name: "奸雄", type: "passive", description: "领地资源+20%" } },
  { id: "zhouyu", name: "周瑜", specialty: "archer", baseAttack: 8, baseDefense: 5, baseSpeed: 2, skill: { name: "连环计", type: "active", description: "敌将1tick无法行动" } },
  { id: "zhangf", name: "张飞", specialty: "infantry", baseAttack: 9, baseDefense: 6, baseSpeed: 2, skill: { name: "咆哮", type: "passive", description: "周围友军攻击+15%" } },
  { id: "simay", name: "司马懿", specialty: "all", baseAttack: 6, baseDefense: 8, baseSpeed: 2, skill: { name: "隐忍", type: "passive", description: "科技速度+30%" } },
  { id: "sunce", name: "孙策", specialty: "cavalry", baseAttack: 8, baseDefense: 5, baseSpeed: 3, skill: { name: "霸王", type: "passive", description: "攻城伤害+50%" } },
  { id: "huangz", name: "黄忠", specialty: "archer", baseAttack: 9, baseDefense: 4, baseSpeed: 1, skill: { name: "百步穿杨", type: "passive", description: "弓兵攻击+25%" } },
];

export const GENERALS_PER_FACTION = 3;
export const GENERAL_RESPAWN_TICKS = 3;
export const GENERAL_MAX_LEVEL = 10;
export const EXP_PER_LEVEL = 100;

// === City ===
export const CAPITAL_DEFENSE = 8;
export const CITY_DEFENSE = 4;
export const WALL_DEFENSE_PER_LEVEL = 3; // walls 0-3 → +0/+3/+6/+9
export const MAX_CITY_LEVEL = 5;
export const MAX_WALLS = 3;
export const CITY_UPGRADE_COST: Resources = { gold: 20, food: 15, wood: 15, iron: 10 };
export const WALL_UPGRADE_COST: Resources = { gold: 10, food: 0, wood: 10, iron: 15 };

// === Territory ===
export const BASE_GOLD_PER_TILE = 1;
export const FOOD_PER_100_TROOPS = 1;
export const MAX_ARMIES_PER_FACTION = 3; // limited by generals

// === Buildings ===
export interface BuildingDef {
  readonly type: BuildingType;
  readonly terrain: readonly TerrainType[] | "any_land";
  readonly cost: Resources;
  readonly income: Partial<Resources>;
  readonly defenseBonus: number;
  readonly visionBonus: number;
  readonly requiresTech: string | null;
}

export const BUILDING_DEFS: Record<BuildingType, BuildingDef> = {
  farm:        { type: "farm",        terrain: ["plains"],   cost: { gold: 3, food: 0, wood: 3, iron: 0 }, income: { food: 3 }, defenseBonus: 0, visionBonus: 0, requiresTech: null },
  lumber_mill: { type: "lumber_mill", terrain: ["forest"],   cost: { gold: 3, food: 0, wood: 0, iron: 2 }, income: { wood: 3 }, defenseBonus: 0, visionBonus: 0, requiresTech: null },
  mine:        { type: "mine",        terrain: ["mountain"], cost: { gold: 5, food: 0, wood: 3, iron: 0 }, income: { iron: 3 }, defenseBonus: 0, visionBonus: 0, requiresTech: "mining" },
  market:      { type: "market",      terrain: "any_land",   cost: { gold: 0, food: 0, wood: 5, iron: 2 }, income: { gold: 4 }, defenseBonus: 0, visionBonus: 0, requiresTech: "currency" },
  barracks:    { type: "barracks",    terrain: "any_land",   cost: { gold: 5, food: 0, wood: 5, iron: 3 }, income: {},           defenseBonus: 0, visionBonus: 0, requiresTech: null },
  watchtower:  { type: "watchtower",  terrain: "any_land",   cost: { gold: 3, food: 0, wood: 4, iron: 1 }, income: {},           defenseBonus: 1, visionBonus: 2, requiresTech: null },
  fortress:    { type: "fortress",    terrain: "any_land",   cost: { gold: 10, food: 0, wood: 8, iron: 8 }, income: {},          defenseBonus: 5, visionBonus: 1, requiresTech: "masonry" },
};

// === Tech Tree ===
export interface TechDef {
  readonly id: string;
  readonly name: string;
  readonly cost: Resources;
  readonly prerequisites: readonly string[];
  readonly effects: readonly string[];
}

export const TECH_TREE: readonly TechDef[] = [
  // Era 1
  { id: "agriculture", name: "农耕", cost: { gold: 5, food: 0, wood: 0, iron: 0 }, prerequisites: [], effects: ["农田产出+50%"] },
  { id: "logging", name: "伐木", cost: { gold: 5, food: 0, wood: 0, iron: 0 }, prerequisites: [], effects: ["伐木场产出+50%"] },
  { id: "mining", name: "采矿", cost: { gold: 5, food: 0, wood: 0, iron: 0 }, prerequisites: [], effects: ["解锁矿场"] },
  { id: "archery", name: "弓术", cost: { gold: 8, food: 0, wood: 3, iron: 0 }, prerequisites: [], effects: ["弓兵攻击+1"] },
  { id: "horsemanship", name: "骑术", cost: { gold: 8, food: 0, wood: 0, iron: 3 }, prerequisites: [], effects: ["骑兵速度+1"] },
  // Era 2
  { id: "iron_working", name: "铁器", cost: { gold: 12, food: 0, wood: 0, iron: 5 }, prerequisites: ["mining"], effects: ["步兵攻防+1"] },
  { id: "currency", name: "货币", cost: { gold: 10, food: 0, wood: 0, iron: 0 }, prerequisites: ["agriculture"], effects: ["解锁市场"] },
  { id: "masonry", name: "石工", cost: { gold: 12, food: 0, wood: 5, iron: 5 }, prerequisites: ["mining"], effects: ["解锁要塞, 城墙+1上限"] },
  { id: "tactics", name: "兵法", cost: { gold: 15, food: 0, wood: 0, iron: 5 }, prerequisites: ["archery", "horsemanship"], effects: ["所有兵种攻击+1"] },
  // Era 3
  { id: "steel", name: "钢铁", cost: { gold: 20, food: 0, wood: 0, iron: 15 }, prerequisites: ["iron_working"], effects: ["所有兵种攻防+2"] },
  { id: "logistics", name: "后勤", cost: { gold: 18, food: 5, wood: 5, iron: 0 }, prerequisites: ["currency", "tactics"], effects: ["行军速度+1, 粮食消耗-30%"] },
  { id: "siege", name: "攻城术", cost: { gold: 20, food: 0, wood: 10, iron: 10 }, prerequisites: ["masonry", "tactics"], effects: ["攻城伤害+50%"] },
];

// === Starting Resources ===
export const STARTING_RESOURCES: Resources = { gold: 30, food: 50, wood: 20, iron: 10 };
export const STARTING_GARRISON: { infantry: number; cavalry: number; archer: number } = { infantry: 300, cavalry: 0, archer: 0 };
export const STARTING_ARMY_TROOPS: { infantry: number; cavalry: number; archer: number } = { infantry: 200, cavalry: 100, archer: 100 };

// === Tick ===
export const TICK_INTERVAL_MS = 5000;
