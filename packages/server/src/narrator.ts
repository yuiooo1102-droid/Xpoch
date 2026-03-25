import type { GameState, LogEntry } from "@xpoch/shared";

export function narrate(entry: LogEntry, _state: GameState): string {
  return `[Tick ${entry.tick}] ${entry.message}`;
}

export function generateSummary(state: GameState): string {
  const aliveFactions = [...state.factions.values()].filter((f) => f.alive);
  const lines: string[] = [
    `=== Xpoch Status (Tick ${state.tick}) ===`,
    "",
  ];

  for (const faction of aliveFactions) {
    const tileCount = [...state.tiles.values()].filter(
      (t) => t.owner === faction.id
    ).length;
    const armyCount = [...state.tiles.values()]
      .filter((t) => t.owner === faction.id)
      .reduce((sum, t) => sum + t.army, 0);

    lines.push(
      `${faction.name}: ${tileCount} tiles, ${armyCount} army, ${faction.gold} gold, ${faction.food} food`
    );
  }

  if (state.winner) {
    lines.push("", `WINNER: ${state.factions.get(state.winner)?.name}`);
  }

  return lines.join("\n");
}
