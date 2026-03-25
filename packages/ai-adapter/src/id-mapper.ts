import type { GameState, FactionId, TurnDecision, MilitaryOrder } from "@xpoch/shared";

/**
 * Build short ID → real ID mappings for units and cities.
 * Prompt uses u0, u1... for units and real city IDs.
 */
export function buildIdMap(state: GameState, factionId: FactionId): ReadonlyMap<string, string> {
  const map = new Map<string, string>();
  let i = 0;
  for (const unit of state.units.values()) {
    if (unit.factionId === factionId) {
      map.set(`u${i}`, unit.id);
      i++;
    }
  }
  return map;
}

/**
 * Remap short IDs in a TurnDecision back to real IDs.
 */
export function remapIds(decision: TurnDecision, idMap: ReadonlyMap<string, string>): TurnDecision {
  const military: MilitaryOrder[] = decision.military.map((o) => ({
    ...o,
    unitId: idMap.get(o.unitId) ?? o.unitId, // fallback to original if not in map
  }));

  return { ...decision, military };
}
