import type { TerrainType, TroopType, BuildingType, GeneralDef, Resources, HistoricalFaction } from "./types";

// === Map ===
export const MAP_SIZE = 12;

// === Terrain Resources per tick ===
export const TERRAIN_INCOME: Record<TerrainType, Partial<Resources>> = {
  plains: { food: 3, gold: 1 },
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
  // === 蜀汉 (Shu) ===
  { id: "liubei", name: "刘备", specialty: "all", baseAttack: 6, baseDefense: 7, baseSpeed: 2, skill: { name: "仁德", type: "passive", description: "周围友军士气+20%" }, historicalFaction: "shu" },
  { id: "zhugeliang", name: "诸葛亮", specialty: "archer", baseAttack: 7, baseDefense: 6, baseSpeed: 2, skill: { name: "空城计", type: "active", description: "敌军攻击力-30%一回合" }, historicalFaction: "shu" },
  { id: "guanyu", name: "关羽", specialty: "infantry", baseAttack: 9, baseDefense: 8, baseSpeed: 2, skill: { name: "过五关斩六将", type: "passive", description: "攻击+30%, 步兵防御+20%" }, historicalFaction: "shu" },
  { id: "zhangfei", name: "张飞", specialty: "infantry", baseAttack: 9, baseDefense: 6, baseSpeed: 2, skill: { name: "长坂桥", type: "active", description: "令敌军一回合无法行动" }, historicalFaction: "shu" },
  { id: "zhaoyun", name: "赵云", specialty: "cavalry", baseAttack: 9, baseDefense: 7, baseSpeed: 3, skill: { name: "七进七出", type: "passive", description: "速度+1, 首回合双倍伤害" }, historicalFaction: "shu" },
  { id: "machao", name: "马超", specialty: "cavalry", baseAttack: 9, baseDefense: 5, baseSpeed: 3, skill: { name: "锦马超", type: "passive", description: "骑兵攻击+25%" }, historicalFaction: "shu" },
  { id: "huangzhong", name: "黄忠", specialty: "archer", baseAttack: 9, baseDefense: 5, baseSpeed: 1, skill: { name: "百步穿杨", type: "passive", description: "弓兵攻击+25%" }, historicalFaction: "shu" },
  { id: "weiyan", name: "魏延", specialty: "infantry", baseAttack: 8, baseDefense: 6, baseSpeed: 2, skill: { name: "子午谷奇谋", type: "active", description: "突袭伤害+40%" }, historicalFaction: "shu" },
  { id: "jiangwei", name: "姜维", specialty: "all", baseAttack: 7, baseDefense: 7, baseSpeed: 2, skill: { name: "麒麟儿", type: "passive", description: "所有兵种攻防+10%" }, historicalFaction: "shu" },
  { id: "pangtong", name: "庞统", specialty: "archer", baseAttack: 7, baseDefense: 5, baseSpeed: 2, skill: { name: "连环计", type: "active", description: "敌军防御-25%一回合" }, historicalFaction: "shu" },
  { id: "fazheng", name: "法正", specialty: "all", baseAttack: 6, baseDefense: 6, baseSpeed: 2, skill: { name: "奇谋", type: "active", description: "提升友军攻击+20%一回合" }, historicalFaction: "shu" },
  { id: "guanping", name: "关平", specialty: "infantry", baseAttack: 7, baseDefense: 7, baseSpeed: 2, skill: { name: "父子同心", type: "passive", description: "与关羽同阵时攻防+15%" }, historicalFaction: "shu" },
  { id: "guanxing", name: "关兴", specialty: "cavalry", baseAttack: 7, baseDefense: 6, baseSpeed: 3, skill: { name: "承父之志", type: "passive", description: "骑兵攻击+15%" }, historicalFaction: "shu" },
  { id: "zhangbao", name: "张苞", specialty: "cavalry", baseAttack: 7, baseDefense: 5, baseSpeed: 3, skill: { name: "虎父虎子", type: "passive", description: "与张飞之子同阵时攻击+15%" }, historicalFaction: "shu" },
  { id: "madai", name: "马岱", specialty: "cavalry", baseAttack: 7, baseDefense: 5, baseSpeed: 3, skill: { name: "斩魏延", type: "active", description: "对敌将额外伤害+30%" }, historicalFaction: "shu" },
  { id: "liaohua", name: "廖化", specialty: "infantry", baseAttack: 6, baseDefense: 6, baseSpeed: 2, skill: { name: "蜀中先锋", type: "passive", description: "步兵速度+1" }, historicalFaction: "shu" },
  { id: "huangyueying", name: "黄月英", specialty: "archer", baseAttack: 6, baseDefense: 5, baseSpeed: 2, skill: { name: "木牛流马", type: "passive", description: "后勤消耗-30%" }, historicalFaction: "shu" },
  { id: "yanyan", name: "严颜", specialty: "infantry", baseAttack: 7, baseDefense: 7, baseSpeed: 1, skill: { name: "断头将军", type: "passive", description: "防御+20%, 绝不投降" }, historicalFaction: "shu" },
  { id: "wangping", name: "王平", specialty: "infantry", baseAttack: 6, baseDefense: 7, baseSpeed: 2, skill: { name: "街亭守备", type: "passive", description: "防御地形加成+30%" }, historicalFaction: "shu" },
  { id: "zhangyi", name: "张翼", specialty: "infantry", baseAttack: 6, baseDefense: 6, baseSpeed: 2, skill: { name: "坚守", type: "passive", description: "城防+15%" }, historicalFaction: "shu" },

  // === 魏国 (Wei) ===
  { id: "caocao", name: "曹操", specialty: "all", baseAttack: 7, baseDefense: 7, baseSpeed: 2, skill: { name: "挟天子以令诸侯", type: "passive", description: "领地资源+20%, 外交优势" }, historicalFaction: "wei" },
  { id: "simayi", name: "司马懿", specialty: "all", baseAttack: 6, baseDefense: 8, baseSpeed: 2, skill: { name: "隐忍", type: "passive", description: "科技速度+30%, 防御+15%" }, historicalFaction: "wei" },
  { id: "zhangliao", name: "张辽", specialty: "cavalry", baseAttack: 8, baseDefense: 7, baseSpeed: 3, skill: { name: "逍遥津", type: "active", description: "突击伤害+35%" }, historicalFaction: "wei" },
  { id: "xuchu", name: "许褚", specialty: "infantry", baseAttack: 9, baseDefense: 7, baseSpeed: 1, skill: { name: "虎痴", type: "passive", description: "步兵攻防+20%" }, historicalFaction: "wei" },
  { id: "dianwei", name: "典韦", specialty: "infantry", baseAttack: 10, baseDefense: 6, baseSpeed: 1, skill: { name: "古之恶来", type: "passive", description: "攻击+25%但防御-10%" }, historicalFaction: "wei" },
  { id: "xiahoudun", name: "夏侯惇", specialty: "infantry", baseAttack: 8, baseDefense: 7, baseSpeed: 2, skill: { name: "拔矢啖睛", type: "passive", description: "受伤时攻击+30%" }, historicalFaction: "wei" },
  { id: "xiahouyuan", name: "夏侯渊", specialty: "cavalry", baseAttack: 8, baseDefense: 5, baseSpeed: 3, skill: { name: "急袭", type: "active", description: "行军速度+2, 突袭+20%" }, historicalFaction: "wei" },
  { id: "caoren", name: "曹仁", specialty: "infantry", baseAttack: 7, baseDefense: 8, baseSpeed: 2, skill: { name: "铁壁", type: "passive", description: "城防+25%, 步兵防御+15%" }, historicalFaction: "wei" },
  { id: "caohong", name: "曹洪", specialty: "cavalry", baseAttack: 7, baseDefense: 6, baseSpeed: 3, skill: { name: "舍身护主", type: "passive", description: "友军主将受伤减半" }, historicalFaction: "wei" },
  { id: "zhanghe", name: "张郃", specialty: "cavalry", baseAttack: 8, baseDefense: 6, baseSpeed: 3, skill: { name: "巧变", type: "passive", description: "地形移动消耗-1" }, historicalFaction: "wei" },
  { id: "xuhuang", name: "徐晃", specialty: "infantry", baseAttack: 8, baseDefense: 7, baseSpeed: 2, skill: { name: "长驱直入", type: "active", description: "攻城伤害+30%" }, historicalFaction: "wei" },
  { id: "pangde", name: "庞德", specialty: "cavalry", baseAttack: 8, baseDefense: 6, baseSpeed: 3, skill: { name: "抬棺决战", type: "passive", description: "攻击时无视城防" }, historicalFaction: "wei" },
  { id: "yujin", name: "于禁", specialty: "infantry", baseAttack: 7, baseDefense: 7, baseSpeed: 2, skill: { name: "治军严整", type: "passive", description: "步兵防御+20%" }, historicalFaction: "wei" },
  { id: "lidian", name: "李典", specialty: "archer", baseAttack: 7, baseDefense: 6, baseSpeed: 2, skill: { name: "儒将", type: "passive", description: "弓兵攻击+15%, 防御+10%" }, historicalFaction: "wei" },
  { id: "yuejin", name: "乐进", specialty: "infantry", baseAttack: 7, baseDefense: 5, baseSpeed: 2, skill: { name: "先登", type: "active", description: "攻城时攻击+25%" }, historicalFaction: "wei" },
  { id: "guojia", name: "郭嘉", specialty: "all", baseAttack: 6, baseDefense: 5, baseSpeed: 2, skill: { name: "十胜十败", type: "active", description: "预判敌军行动, 全军攻击+20%" }, historicalFaction: "wei" },
  { id: "xunyu", name: "荀彧", specialty: "all", baseAttack: 5, baseDefense: 6, baseSpeed: 2, skill: { name: "王佐之才", type: "passive", description: "资源产出+25%" }, historicalFaction: "wei" },
  { id: "jiaxu", name: "贾诩", specialty: "all", baseAttack: 6, baseDefense: 6, baseSpeed: 2, skill: { name: "毒士", type: "active", description: "敌军士气-25%一回合" }, historicalFaction: "wei" },
  { id: "dengai", name: "邓艾", specialty: "infantry", baseAttack: 8, baseDefense: 7, baseSpeed: 2, skill: { name: "偷渡阴平", type: "active", description: "无视地形直击敌后方" }, historicalFaction: "wei" },
  { id: "zhonghui", name: "钟会", specialty: "all", baseAttack: 7, baseDefense: 6, baseSpeed: 2, skill: { name: "伐蜀", type: "active", description: "攻击蜀军时伤害+25%" }, historicalFaction: "wei" },

  // === 吴国 (Wu) ===
  { id: "sunce", name: "孙策", specialty: "cavalry", baseAttack: 8, baseDefense: 5, baseSpeed: 3, skill: { name: "小霸王", type: "passive", description: "攻城伤害+50%" }, historicalFaction: "wu" },
  { id: "sunquan", name: "孙权", specialty: "all", baseAttack: 6, baseDefense: 7, baseSpeed: 2, skill: { name: "坐断东南", type: "passive", description: "防御地形加成+25%, 资源+15%" }, historicalFaction: "wu" },
  { id: "zhouyu", name: "周瑜", specialty: "archer", baseAttack: 8, baseDefense: 6, baseSpeed: 2, skill: { name: "火烧赤壁", type: "active", description: "对敌军额外火攻伤害+40%" }, historicalFaction: "wu" },
  { id: "lvmeng", name: "吕蒙", specialty: "infantry", baseAttack: 7, baseDefense: 7, baseSpeed: 2, skill: { name: "白衣渡江", type: "active", description: "无视地形移动, 突袭+20%" }, historicalFaction: "wu" },
  { id: "luxun", name: "陆逊", specialty: "archer", baseAttack: 7, baseDefense: 7, baseSpeed: 2, skill: { name: "火烧连营", type: "active", description: "火攻伤害+35%, 敌军速度-1" }, historicalFaction: "wu" },
  { id: "ganning", name: "甘宁", specialty: "infantry", baseAttack: 8, baseDefense: 5, baseSpeed: 2, skill: { name: "百骑劫营", type: "active", description: "夜袭伤害+40%" }, historicalFaction: "wu" },
  { id: "taishici", name: "太史慈", specialty: "archer", baseAttack: 8, baseDefense: 6, baseSpeed: 2, skill: { name: "神射", type: "passive", description: "弓兵攻击+25%" }, historicalFaction: "wu" },
  { id: "huanggai", name: "黄盖", specialty: "infantry", baseAttack: 7, baseDefense: 6, baseSpeed: 2, skill: { name: "苦肉计", type: "active", description: "牺牲生命值换取攻击+50%" }, historicalFaction: "wu" },
  { id: "chengpu", name: "程普", specialty: "infantry", baseAttack: 7, baseDefense: 7, baseSpeed: 2, skill: { name: "三朝元老", type: "passive", description: "全军防御+15%" }, historicalFaction: "wu" },
  { id: "handang", name: "韩当", specialty: "cavalry", baseAttack: 7, baseDefense: 6, baseSpeed: 3, skill: { name: "弓骑", type: "passive", description: "骑兵攻击+15%, 弓兵速度+1" }, historicalFaction: "wu" },
  { id: "zhoutai", name: "周泰", specialty: "infantry", baseAttack: 7, baseDefense: 8, baseSpeed: 2, skill: { name: "护主", type: "passive", description: "主将受伤减半, 防御+20%" }, historicalFaction: "wu" },
  { id: "dingfeng", name: "丁奉", specialty: "infantry", baseAttack: 7, baseDefense: 6, baseSpeed: 2, skill: { name: "雪中奋短兵", type: "active", description: "近战攻击+35%" }, historicalFaction: "wu" },
  { id: "lusu", name: "鲁肃", specialty: "all", baseAttack: 5, baseDefense: 7, baseSpeed: 2, skill: { name: "联刘抗曹", type: "passive", description: "外交加成+30%, 友军士气+15%" }, historicalFaction: "wu" },
  { id: "zhugejin", name: "诸葛瑾", specialty: "all", baseAttack: 5, baseDefense: 6, baseSpeed: 2, skill: { name: "调和", type: "passive", description: "外交成功率+25%" }, historicalFaction: "wu" },
  { id: "lingtong", name: "凌统", specialty: "infantry", baseAttack: 7, baseDefense: 6, baseSpeed: 2, skill: { name: "忠勇", type: "passive", description: "步兵攻击+15%, 士气不降" }, historicalFaction: "wu" },

  // === 群雄 (Neutral) ===
  { id: "lubu", name: "吕布", specialty: "cavalry", baseAttack: 10, baseDefense: 5, baseSpeed: 3, skill: { name: "辕门射戟", type: "active", description: "攻击+40%, 无人可挡" }, historicalFaction: "neutral" },
  { id: "dongzhuo", name: "董卓", specialty: "all", baseAttack: 5, baseDefense: 6, baseSpeed: 1, skill: { name: "暴政", type: "passive", description: "资源掠夺+30%, 民心-20%" }, historicalFaction: "neutral" },
  { id: "yuanshao", name: "袁绍", specialty: "all", baseAttack: 6, baseDefense: 6, baseSpeed: 2, skill: { name: "四世三公", type: "passive", description: "初始兵力+25%" }, historicalFaction: "neutral" },
  { id: "yuanshu", name: "袁术", specialty: "all", baseAttack: 5, baseDefense: 5, baseSpeed: 2, skill: { name: "僭号", type: "passive", description: "资源+20%但外交-20%" }, historicalFaction: "neutral" },
  { id: "gongsunzan", name: "公孙瓒", specialty: "cavalry", baseAttack: 7, baseDefense: 5, baseSpeed: 3, skill: { name: "白马义从", type: "passive", description: "骑兵攻击+20%, 速度+1" }, historicalFaction: "neutral" },
  { id: "taoqian", name: "陶谦", specialty: "all", baseAttack: 4, baseDefense: 7, baseSpeed: 1, skill: { name: "三让徐州", type: "passive", description: "防御+25%, 民心+20%" }, historicalFaction: "neutral" },
  { id: "liubiao", name: "刘表", specialty: "all", baseAttack: 4, baseDefense: 6, baseSpeed: 1, skill: { name: "坐守荆州", type: "passive", description: "领地防御+20%, 资源+15%" }, historicalFaction: "neutral" },
  { id: "zhangxiu", name: "张绣", specialty: "cavalry", baseAttack: 7, baseDefense: 5, baseSpeed: 3, skill: { name: "北地枪王", type: "passive", description: "骑兵攻击+20%" }, historicalFaction: "neutral" },
  { id: "mateng", name: "马腾", specialty: "cavalry", baseAttack: 7, baseDefense: 6, baseSpeed: 3, skill: { name: "西凉铁骑", type: "passive", description: "骑兵攻防+15%" }, historicalFaction: "neutral" },
  { id: "diaochan", name: "貂蝉", specialty: "all", baseAttack: 3, baseDefense: 4, baseSpeed: 2, skill: { name: "离间计", type: "active", description: "令敌军两将互攻一回合" }, historicalFaction: "neutral" },
  { id: "huatuo", name: "华佗", specialty: "all", baseAttack: 2, baseDefense: 5, baseSpeed: 2, skill: { name: "妙手回春", type: "active", description: "治愈友军, 恢复伤兵30%" }, historicalFaction: "neutral" },
];

export const GENERALS_PER_FACTION = 5;

// === City Names (Three Kingdoms themed) ===
export const CITY_NAMES: Record<HistoricalFaction, readonly string[]> = {
  shu: ["成都", "汉中", "白帝城", "绵竹", "剑阁", "南中", "阆中", "梓潼", "涪城", "葭萌关"],
  wei: ["洛阳", "许昌", "邺城", "长安", "宛城", "合肥", "陈留", "濮阳", "官渡", "潼关"],
  wu: ["建业", "柴桑", "武昌", "庐江", "会稽", "南郡", "夷陵", "濡须", "吴郡", "丹阳"],
  neutral: ["荆州", "襄阳", "徐州", "兖州", "冀州", "豫州", "下邳", "小沛", "虎牢关", "汜水关"],
};
export const GENERAL_RESPAWN_TICKS = 3;
export const GENERAL_MAX_LEVEL = 10;
export const EXP_PER_LEVEL = 100;

// === City ===
export const CAPITAL_DEFENSE = 15;
export const CITY_DEFENSE = 8;
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
  farm:        { type: "farm",        terrain: ["plains"],   cost: { gold: 3, food: 0, wood: 3, iron: 0 }, income: { food: 5 }, defenseBonus: 0, visionBonus: 0, requiresTech: null },
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
export const STARTING_RESOURCES: Resources = { gold: 30, food: 80, wood: 20, iron: 10 };
export const STARTING_GARRISON: { infantry: number; cavalry: number; archer: number } = { infantry: 500, cavalry: 100, archer: 100 };
export const STARTING_ARMY_TROOPS: { infantry: number; cavalry: number; archer: number } = { infantry: 200, cavalry: 100, archer: 100 };

// === Tick ===
export const TICK_INTERVAL_MS = 5000;
