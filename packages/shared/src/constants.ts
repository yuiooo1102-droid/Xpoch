import type { UnitType, TechEra, BuildingType, TerrainType, NaturalResource, TrumpMap } from "./types";

// === Map ===

export const MAP_SIZE = 10;

// === Terrain Stats ===

export const TERRAIN_GOLD: Record<TerrainType, number> = {
  plains: 1,
  forest: 0,
  mountain: 1,
  water: 0,
  desert: 0,
};

export const TERRAIN_PRODUCTION: Record<TerrainType, number> = {
  plains: 2,
  forest: 2,
  mountain: 1,
  water: 0,
  desert: 0,
};

export const TERRAIN_DEFENSE_BONUS: Record<TerrainType, number> = {
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

// === Unit Stats ===

export interface UnitStats {
  readonly strength: number;
  readonly movement: number;
  readonly cost: number; // gold
}

export const UNIT_STATS: Record<UnitType, UnitStats> = {
  infantry: { strength: 3, movement: 1, cost: 4 },
  cavalry: { strength: 3, movement: 2, cost: 6 },
  artillery: { strength: 4, movement: 1, cost: 8 },
  settler: { strength: 0, movement: 1, cost: 10 },
  scout: { strength: 1, movement: 3, cost: 3 },
};

// Trump: A trumps B means A deals damage first
export const TRUMP: TrumpMap = {
  infantry: "cavalry",    // infantry trumps cavalry
  cavalry: "artillery",   // cavalry trumps artillery
  artillery: "infantry",  // artillery trumps infantry
  settler: null,
  scout: null,
};

export const MAX_STACK_SIZE = 3;

// === City ===

export const CITY_DEFENSE_BONUS = 4;
export const CAPITAL_DEFENSE_BONUS = 8;
export const WALLS_DEFENSE_BONUS = 4;
export const MIN_CITY_DISTANCE = 3; // min hexes between cities
export const MAX_CITIES = 4; // capital + 3

// === Economy ===

export const FOOD_PER_UNIT = 1;
export const MAX_STORED_FOOD = 20;
export const RUSH_GOLD_MULTIPLIER = 2; // pay 2x gold to rush production
export const STARTING_GOLD = 20;
export const STARTING_FOOD = 30;
export const BASE_FOOD_PER_CITY = 3;
export const BASE_RESEARCH_PER_CITY = 1;
export const STARTING_TECHS: readonly string[] = ["agriculture"];

// === Building Stats ===

export interface BuildingStats {
  readonly cost: number; // production cost
  readonly terrains: readonly TerrainType[]; // allowed terrains ("any_land" handled separately)
  readonly anyLand: boolean;
  readonly effect: string;
  readonly goldBonus: number;
  readonly productionBonus: number;
  readonly researchBonus: number;
  readonly foodBonus: number;
  readonly defenseBonus: number;
  readonly requiresTech: string | null;
}

export const BUILDING_STATS: Record<BuildingType, BuildingStats> = {
  granary:     { cost: 4,  terrains: ["plains"], anyLand: false, effect: "+2 food", goldBonus: 0, productionBonus: 0, researchBonus: 0, foodBonus: 2, defenseBonus: 0, requiresTech: "pottery" },
  barracks:    { cost: 6,  terrains: [], anyLand: true, effect: "Units +1 str", goldBonus: 0, productionBonus: 0, researchBonus: 0, foodBonus: 0, defenseBonus: 0, requiresTech: null },
  workshop:    { cost: 5,  terrains: ["mountain", "forest"], anyLand: false, effect: "+2 production", goldBonus: 0, productionBonus: 2, researchBonus: 0, foodBonus: 0, defenseBonus: 0, requiresTech: "mining" },
  market:      { cost: 5,  terrains: [], anyLand: true, effect: "+2 gold/turn", goldBonus: 2, productionBonus: 0, researchBonus: 0, foodBonus: 0, defenseBonus: 0, requiresTech: "currency" },
  library:     { cost: 6,  terrains: [], anyLand: true, effect: "+2 research/turn", goldBonus: 0, productionBonus: 0, researchBonus: 2, foodBonus: 0, defenseBonus: 0, requiresTech: null },
  city_walls:  { cost: 8,  terrains: [], anyLand: true, effect: "+4 city defense", goldBonus: 0, productionBonus: 0, researchBonus: 0, foodBonus: 0, defenseBonus: 4, requiresTech: "masonry" },
  harbor:      { cost: 7,  terrains: ["water"], anyLand: false, effect: "+2 gold, +1 prod", goldBonus: 2, productionBonus: 1, researchBonus: 0, foodBonus: 0, defenseBonus: 0, requiresTech: "sailing" },
  fortress:    { cost: 10, terrains: [], anyLand: true, effect: "+3 hex defense, holds 5", goldBonus: 0, productionBonus: 0, researchBonus: 0, foodBonus: 0, defenseBonus: 3, requiresTech: "masonry" },
  factory:     { cost: 12, terrains: [], anyLand: true, effect: "+4 production", goldBonus: 0, productionBonus: 4, researchBonus: 0, foodBonus: 0, defenseBonus: 0, requiresTech: "industrialization" },
  airport:     { cost: 15, terrains: [], anyLand: true, effect: "Deploy aircraft here", goldBonus: 0, productionBonus: 0, researchBonus: 0, foodBonus: 0, defenseBonus: 0, requiresTech: "flight" },
};

// === Tech Tree ===

export interface TechDef {
  readonly id: string;
  readonly name: string;
  readonly era: TechEra;
  readonly cost: number;
  readonly prerequisites: readonly string[];
  readonly effects: readonly string[];
}

export const TECH_TREE: readonly TechDef[] = [
  // Era 1: Ancient
  { id: "agriculture", name: "Agriculture", era: "ancient", cost: 6, prerequisites: [], effects: ["Plains +1 food"] },
  { id: "mining", name: "Mining", era: "ancient", cost: 6, prerequisites: [], effects: ["Mountain +1 gold"] },
  { id: "bronze_working", name: "Bronze Working", era: "ancient", cost: 8, prerequisites: [], effects: ["Unlock Barracks"] },
  { id: "pottery", name: "Pottery", era: "ancient", cost: 6, prerequisites: [], effects: ["Unlock Granary"] },
  { id: "animal_husbandry", name: "Animal Husbandry", era: "ancient", cost: 8, prerequisites: [], effects: ["Unlock Cavalry"] },

  // Era 2: Classical
  { id: "iron_working", name: "Iron Working", era: "classical", cost: 12, prerequisites: ["bronze_working", "mining"], effects: ["Infantry → Swordsmen (str 5)"] },
  { id: "horseback_riding", name: "Horseback Riding", era: "classical", cost: 12, prerequisites: ["animal_husbandry"], effects: ["Cavalry → Knights (str 5, move 3)"] },
  { id: "masonry", name: "Masonry", era: "classical", cost: 14, prerequisites: ["mining"], effects: ["Unlock City Walls, Fortress"] },
  { id: "currency", name: "Currency", era: "classical", cost: 12, prerequisites: ["pottery"], effects: ["Unlock Market (+2 gold)"] },
  { id: "navigation", name: "Navigation", era: "classical", cost: 16, prerequisites: ["animal_husbandry"], effects: ["Units can cross water"] },

  // Era 3: Medieval
  { id: "gunpowder", name: "Gunpowder", era: "medieval", cost: 18, prerequisites: ["iron_working"], effects: ["Artillery → Cannon (str 6)"] },
  { id: "engineering", name: "Engineering", era: "medieval", cost: 20, prerequisites: ["masonry", "currency"], effects: ["Buildings cost -2 production"] },
  { id: "sailing", name: "Sailing", era: "medieval", cost: 18, prerequisites: ["navigation"], effects: ["Units stop on water, Unlock Harbor"] },
  { id: "theology", name: "Theology", era: "medieval", cost: 20, prerequisites: ["currency"], effects: ["Libraries +1 research"] },
  { id: "feudalism", name: "Feudalism", era: "medieval", cost: 22, prerequisites: ["horseback_riding", "masonry"], effects: ["+1 max stacking"] },

  // Era 4: Industrial
  { id: "industrialization", name: "Industrialization", era: "industrial", cost: 24, prerequisites: ["engineering", "gunpowder"], effects: ["Unlock Tanks (str 7), Factory"] },
  { id: "railroad", name: "Railroad", era: "industrial", cost: 26, prerequisites: ["engineering"], effects: ["All units +1 movement"] },
  { id: "rifling", name: "Rifling", era: "industrial", cost: 24, prerequisites: ["gunpowder"], effects: ["Infantry +2 strength"] },
  { id: "steam_power", name: "Steam Power", era: "industrial", cost: 28, prerequisites: ["sailing", "engineering"], effects: ["Cities +3 production"] },
  { id: "dynamite", name: "Dynamite", era: "industrial", cost: 26, prerequisites: ["gunpowder"], effects: ["+4 damage vs cities"] },

  // Era 5: Modern
  { id: "flight", name: "Flight", era: "modern", cost: 32, prerequisites: ["industrialization"], effects: ["Unlock Aircraft (str 6, move 4), Airport"] },
  { id: "nuclear_fission", name: "Nuclear Fission", era: "modern", cost: 40, prerequisites: ["industrialization", "steam_power"], effects: ["Unlock Nuke (destroys city, 30 gold)"] },
  { id: "computers", name: "Computers", era: "modern", cost: 34, prerequisites: ["industrialization"], effects: ["All cities +3 research"] },
  { id: "rocketry", name: "Rocketry", era: "modern", cost: 36, prerequisites: ["flight", "dynamite"], effects: ["Artillery range 2 hexes"] },
  { id: "modern_armor", name: "Modern Armor", era: "modern", cost: 32, prerequisites: ["industrialization"], effects: ["Tanks → Modern Armor (str 9, move 3)"] },
];

// === Wonders ===

export interface WonderDef {
  readonly id: string;
  readonly name: string;
  readonly era: TechEra;
  readonly cost: number;
  readonly effect: string;
}

export const WONDER_DEFS: readonly WonderDef[] = [
  { id: "great_wall", name: "Great Wall", era: "ancient", cost: 15, effect: "All cities +2 defense" },
  { id: "colossus", name: "Colossus", era: "ancient", cost: 12, effect: "+3 gold per turn" },
  { id: "pyramids", name: "Pyramids", era: "ancient", cost: 18, effect: "Settlers cost 50% less" },
  { id: "himeji", name: "Himeji Castle", era: "medieval", cost: 20, effect: "All defending units +1 str" },
  { id: "machu_picchu", name: "Machu Picchu", era: "medieval", cost: 16, effect: "Mountain tiles +2 gold" },
  { id: "kremlin", name: "Kremlin", era: "industrial", cost: 25, effect: "Rush production 50% cheaper" },
  { id: "pentagon", name: "Pentagon", era: "modern", cost: 30, effect: "+2 stacking limit" },
  { id: "manhattan", name: "Manhattan Project", era: "modern", cost: 35, effect: "Unlock Nukes without Nuclear Fission" },
];

// === Tick ===

export const TICK_INTERVAL_MS = 8000;
export const MAX_ACTIONS_PER_TURN = 5;
