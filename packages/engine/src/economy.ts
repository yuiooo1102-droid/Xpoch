import type { GameState, FactionId } from "@xpoch/shared";
import { BASE_GOLD_PER_TILE, FOOD_PER_UNIT } from "@xpoch/shared";
import { updateFaction, addLogEntry } from "./game-state";

export function processEconomy(state: GameState): GameState {
  let s = state;

  const factionTileCount = new Map<FactionId, number>();
  const factionArmyCount = new Map<FactionId, number>();
  const factionResourceIncome = new Map<FactionId, number>();

  for (const tile of s.tiles.values()) {
    if (tile.owner) {
      factionTileCount.set(tile.owner, (factionTileCount.get(tile.owner) ?? 0) + 1);
      factionArmyCount.set(tile.owner, (factionArmyCount.get(tile.owner) ?? 0) + tile.army);
      factionResourceIncome.set(tile.owner, (factionResourceIncome.get(tile.owner) ?? 0) + tile.resources);
    }
  }

  for (const [factionId, faction] of s.factions) {
    if (!faction.alive) continue;

    const tileCount = factionTileCount.get(factionId) ?? 0;
    const armyCount = factionArmyCount.get(factionId) ?? 0;
    const resourceIncome = factionResourceIncome.get(factionId) ?? 0;

    if (tileCount === 0) {
      s = updateFaction(s, factionId, { alive: false });
      s = addLogEntry(s, `${faction.name} has been ELIMINATED!`, [factionId]);
      continue;
    }

    const goldIncome = tileCount * BASE_GOLD_PER_TILE;
    const foodIncome = resourceIncome;
    const foodCost = armyCount * FOOD_PER_UNIT;

    s = updateFaction(s, factionId, {
      gold: faction.gold + goldIncome,
      food: Math.max(0, faction.food + foodIncome - foodCost),
    });
  }

  return s;
}
