import type { GameState, FactionId, Tile } from "@xpoch/shared";
import { hexKey } from "@xpoch/shared";

export function buildPrompt(state: GameState, factionId: FactionId): string {
  const faction = state.factions.get(factionId)!;
  const ownedTiles: Tile[] = [];
  const enemyTiles: Tile[] = [];

  for (const tile of state.tiles.values()) {
    if (tile.owner === factionId) ownedTiles.push(tile);
    else if (tile.owner) enemyTiles.push(tile);
  }

  const recentLog = state.log.slice(-10).map((e) => `  - ${e.message}`).join("\n");

  return `You are "${faction.name}", a faction in a hex-based strategy game. You must decide your actions for tick ${state.tick}.

## Your Resources
- gold: ${faction.gold}
- food: ${faction.food}
- territories: ${ownedTiles.length}
- total army: ${ownedTiles.reduce((sum, t) => sum + t.army, 0)}

## Your Territories
${ownedTiles.map((t) => `  ${hexKey(t.coord)}: army=${t.army}, terrain=${t.terrain}`).join("\n")}

## Nearby Enemies
${enemyTiles.slice(0, 15).map((t) => `  ${hexKey(t.coord)}: owner=${t.owner}, army=${t.army}`).join("\n")}

## Diplomacy
${formatDiplomacy(state, factionId)}

## Recent Events
${recentLog || "  (none)"}

## Available Actions (max 3 per turn)
- move: {from, to, amount} — move army to adjacent tile
- attack: {from, to, amount} — attack enemy on adjacent tile
- recruit: {from, amount} — spend gold to add army (cost: 10 gold/unit)
- declare_war: {targetFactionId} — declare war
- propose_alliance: {targetFactionId} — form alliance
- break_alliance: {targetFactionId} — betray an ally
- trade: {targetFactionId, amount} — send gold
- pass: {} — do nothing

Respond with a JSON array of 1-3 actions. Example:
[
  {"type": "recruit", "from": "0,0", "amount": 3},
  {"type": "move", "from": "0,0", "to": "1,0", "amount": 5},
  {"type": "declare_war", "targetFactionId": "enemy1"}
]

Think strategically: expand territory, build economy, manage diplomacy. Betrayal is allowed.
Respond ONLY with the JSON array, no other text.`;
}

function formatDiplomacy(state: GameState, factionId: FactionId): string {
  const lines: string[] = [];
  for (const [key, status] of state.diplomacy.relations) {
    const [a, b] = key.split(":");
    if (a === factionId || b === factionId) {
      const other = a === factionId ? b : a;
      const otherFaction = state.factions.get(other);
      lines.push(`  ${otherFaction?.name ?? other}: ${status}`);
    }
  }
  return lines.length > 0 ? lines.join("\n") : "  (no diplomatic relations)";
}
