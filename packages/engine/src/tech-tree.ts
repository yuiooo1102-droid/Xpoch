import type { GameState, FactionId, TechId, Unit } from "@xpoch/shared";
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
 * Research a tech. Deducts research cost from faction's accumulated research.
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

  // Check cost
  if (faction.research < techDef.cost) return null;

  // Deduct cost and add tech
  let s = updateFaction(state, factionId, {
    research: faction.research - techDef.cost,
    techs: [...faction.techs, techId],
  });

  s = addLogEntry(
    s,
    `${faction.name} researched ${techDef.name}`,
    "tech",
    [factionId],
  );

  // Apply immediate effects
  s = applyTechEffects(s, factionId, techId);

  return s;
}

/**
 * Apply tech effects when researched (e.g., upgrade units, unlock buildings).
 */
export function applyTechEffects(
  state: GameState,
  factionId: FactionId,
  techId: TechId,
): GameState {
  switch (techId) {
    case "iron_working":
      return upgradeUnits(state, factionId, "infantry", { strength: 5, maxStrength: 5, upgraded: true });
    case "horseback_riding":
      return upgradeUnits(state, factionId, "cavalry", { strength: 5, maxStrength: 5, movement: 3, maxMovement: 3, upgraded: true });
    case "gunpowder":
      return upgradeUnits(state, factionId, "artillery", { strength: 6, maxStrength: 6, upgraded: true });
    default:
      return state;
  }
}

function upgradeUnits(
  state: GameState,
  factionId: FactionId,
  unitType: string,
  upgrades: Partial<Unit>,
): GameState {
  const newUnits = new Map(state.units);
  let changed = false;

  for (const [unitId, unit] of newUnits) {
    if (unit.factionId === factionId && unit.type === unitType && !unit.upgraded) {
      newUnits.set(unitId, { ...unit, ...upgrades });
      changed = true;
    }
  }

  return changed ? { ...state, units: newUnits } : state;
}
