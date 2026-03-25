import type { GameState, FactionId } from "@xpoch/shared";

export function checkVictory(state: GameState): FactionId | null {
  const aliveFactions = [...state.factions.values()].filter((f) => f.alive);

  if (aliveFactions.length === 1) {
    return aliveFactions[0].id;
  }

  return null;
}
