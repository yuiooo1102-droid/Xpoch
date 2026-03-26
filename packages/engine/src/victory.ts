import type { GameState, FactionId } from "@xpoch/shared";

export function checkVictory(state: GameState): FactionId | null {
  const aliveFactions = [...state.factions.values()].filter((f) => f.alive);

  if (aliveFactions.length === 1) {
    return aliveFactions[0].id;
  }

  // 0 alive = draw, >1 alive = game continues
  return null;
}

/**
 * A faction is alive if it has at least one city.
 * Returns a new GameState with eliminated factions marked alive=false
 * and their armies disbanded.
 */
export function checkEliminations(state: GameState): GameState {
  const newFactions = new Map(state.factions);
  let newArmies = new Map(state.armies);
  let changed = false;

  for (const [factionId, faction] of state.factions) {
    if (!faction.alive) continue;

    const hasCities = [...state.cities.values()].some(
      (c) => c.factionId === factionId,
    );

    if (!hasCities) {
      newFactions.set(factionId, { ...faction, alive: false });

      // Disband all armies belonging to this faction
      const updatedArmies = new Map(newArmies);
      for (const [armyId, army] of newArmies) {
        if (army.factionId === factionId) {
          updatedArmies.delete(armyId);
        }
      }
      newArmies = updatedArmies;
      changed = true;
    }
  }

  if (!changed) return state;

  return { ...state, factions: newFactions, armies: newArmies };
}
