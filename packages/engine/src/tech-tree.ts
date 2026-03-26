import type { GameState, FactionId, TechId, Resources } from "@xpoch/shared";
import { TECH_TREE, type TechDef } from "@xpoch/shared";
import { updateFaction, addLogEntry } from "./game-state";

/**
 * Get techs available to research for a faction.
 * A tech is available if:
 * 1. Faction hasn't researched it yet
 * 2. All prerequisites are researched
 */
export function getAvailableTechs(
  state: GameState,
  factionId: FactionId,
): readonly TechDef[] {
  const faction = state.factions.get(factionId);
  if (!faction) return [];

  const researched = new Set(faction.techs);

  return TECH_TREE.filter(
    (tech) =>
      !researched.has(tech.id) &&
      tech.prerequisites.every((prereq) => researched.has(prereq)),
  );
}

/**
 * Check if faction has a specific tech.
 */
export function hasTech(
  state: GameState,
  factionId: FactionId,
  techId: TechId,
): boolean {
  const faction = state.factions.get(factionId);
  if (!faction) return false;
  return faction.techs.includes(techId);
}

/**
 * Check if faction can afford a resource cost.
 */
function canAffordResources(have: Resources, cost: Resources): boolean {
  return (
    have.gold >= cost.gold &&
    have.food >= cost.food &&
    have.wood >= cost.wood &&
    have.iron >= cost.iron
  );
}

/**
 * Subtract resources immutably.
 */
function subtractResources(have: Resources, cost: Resources): Resources {
  return {
    gold: have.gold - cost.gold,
    food: have.food - cost.food,
    wood: have.wood - cost.wood,
    iron: have.iron - cost.iron,
  };
}

/**
 * Research a tech. Deducts resource cost from faction.
 * Returns null if can't afford or prerequisites not met.
 */
export function researchTech(
  state: GameState,
  factionId: FactionId,
  techId: TechId,
): GameState | null {
  const faction = state.factions.get(factionId);
  if (!faction) return null;

  const techDef = TECH_TREE.find((t) => t.id === techId);
  if (!techDef) return null;

  // Check prerequisites
  const researched = new Set(faction.techs);
  if (researched.has(techId)) return null;

  const prereqsMet = techDef.prerequisites.every((prereq) =>
    researched.has(prereq),
  );
  if (!prereqsMet) return null;

  // Check cost (resource-based in v3)
  if (!canAffordResources(faction.resources, techDef.cost)) return null;

  // Deduct cost and add tech
  let s = updateFaction(state, factionId, {
    resources: subtractResources(faction.resources, techDef.cost),
    techs: [...faction.techs, techId],
  });

  s = addLogEntry(
    s,
    `${faction.name} researched ${techDef.name}`,
    "tech",
    [factionId],
  );

  return s;
}
