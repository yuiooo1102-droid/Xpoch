import type { GameState, FactionId, DiplomaticStatus } from "@xpoch/shared";

function diplomaticKey(a: FactionId, b: FactionId): string {
  return [a, b].sort().join(":");
}

export function getRelation(
  state: GameState,
  a: FactionId,
  b: FactionId
): DiplomaticStatus {
  return state.diplomacy.relations.get(diplomaticKey(a, b)) ?? "neutral";
}

export function areAllied(
  state: GameState,
  a: FactionId,
  b: FactionId
): boolean {
  return getRelation(state, a, b) === "allied";
}

export function areAtWar(
  state: GameState,
  a: FactionId,
  b: FactionId
): boolean {
  return getRelation(state, a, b) === "war";
}
