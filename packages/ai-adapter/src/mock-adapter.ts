import type {
  AIAdapter,
  TurnDecision,
  ArmyOrder,
  CityOrder,
  BuildOrder,
  GameState,
  FactionId,
} from "@xpoch/shared";
import { TECH_TREE } from "@xpoch/shared";

/**
 * Minimal mock AI — makes simple valid decisions as fallback.
 * Real gameplay should use LLM adapters (Ollama, API).
 * This is only for testing that the engine runs without crashing.
 */
export class MockAdapter implements AIAdapter {
  readonly providerId = "mock";

  async decideActions(
    state: GameState,
    factionId: FactionId,
  ): Promise<TurnDecision> {
    return {
      factionId,
      armies: idleArmies(state, factionId),
      cities: idleCities(state, factionId),
      build: [],
      research: cheapestTech(state, factionId),
      diplomacy: [],
    };
  }
}

function idleArmies(state: GameState, factionId: FactionId): readonly ArmyOrder[] {
  return [...state.armies.values()]
    .filter((a) => a.factionId === factionId)
    .map((a) => ({ generalId: a.generalId, action: "idle" as const }));
}

function idleCities(state: GameState, factionId: FactionId): readonly CityOrder[] {
  return [...state.cities.values()]
    .filter((c) => c.factionId === factionId)
    .map((c) => ({ cityId: c.id, action: "idle" as const }));
}

function cheapestTech(state: GameState, factionId: FactionId): string | null {
  const faction = state.factions.get(factionId);
  if (!faction) return null;
  const available = TECH_TREE.filter((t) => {
    if (faction.techs.includes(t.id)) return false;
    return t.prerequisites.every((p) => faction.techs.includes(p));
  });
  if (available.length === 0) return null;
  const totalCost = (t: typeof available[0]) => t.cost.gold + t.cost.food + t.cost.wood + t.cost.iron;
  return available.sort((a, b) => totalCost(a) - totalCost(b))[0].id;
}
