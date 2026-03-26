import type { GameState, FactionId, TurnDecision, ArmyOrder } from "@xpoch/shared";

/**
 * Build short ID -> real ID mappings for armies.
 * Prompt uses a0, a1... for armies and real city IDs.
 */
export function buildIdMap(state: GameState, factionId: FactionId): ReadonlyMap<string, string> {
  const map = new Map<string, string>();
  let i = 0;
  for (const army of state.armies.values()) {
    if (army.factionId === factionId) {
      map.set(`a${i}`, army.generalId);
      i++;
    }
  }
  return map;
}

/**
 * Remap short IDs in a TurnDecision back to real general IDs.
 */
export function remapIds(decision: TurnDecision, idMap: ReadonlyMap<string, string>): TurnDecision {
  const armies: readonly ArmyOrder[] = decision.armies.map((o) => ({
    ...o,
    generalId: idMap.get(o.generalId) ?? o.generalId,
  }));

  return { ...decision, armies };
}
