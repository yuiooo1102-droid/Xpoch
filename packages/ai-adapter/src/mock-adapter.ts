import type { AIAdapter, Action, GameState, FactionId } from "@xpoch/shared";
import { hexKey, hexNeighbors } from "@xpoch/shared";

export class MockAdapter implements AIAdapter {
  readonly providerId = "mock";

  async decideActions(
    state: GameState,
    factionId: FactionId
  ): Promise<Action[]> {
    const faction = state.factions.get(factionId)!;
    const actions: Action[] = [];

    const ownedTiles = [...state.tiles.values()].filter(
      (t) => t.owner === factionId
    );

    if (ownedTiles.length === 0) return [{ factionId, type: "pass" }];

    if (faction.gold >= 30) {
      const stronghold = ownedTiles.reduce((best, t) =>
        t.army > best.army ? t : best
      );
      actions.push({
        factionId,
        type: "recruit",
        from: stronghold.coord,
        amount: 3,
      });
    }

    for (const tile of ownedTiles) {
      if (tile.army <= 2) continue;
      const neighbors = hexNeighbors(tile.coord);
      for (const n of neighbors) {
        const target = state.tiles.get(hexKey(n));
        if (target && !target.owner && target.terrain !== "water") {
          actions.push({
            factionId,
            type: "move",
            from: tile.coord,
            to: n,
            amount: Math.floor(tile.army / 2),
          });
          break;
        }
      }
      if (actions.length >= 3) break;
    }

    return actions.length > 0 ? actions.slice(0, 3) : [{ factionId, type: "pass" }];
  }
}
