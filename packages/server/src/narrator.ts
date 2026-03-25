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
    const cities = [...state.cities.values()].filter(c => c.factionId === faction.id);
    const units = [...state.units.values()].filter(u => u.factionId === faction.id);
    const techCount = faction.techs.length;

    lines.push(
      `${faction.name}: ${cities.length} cities, ${units.length} units, ${faction.gold} gold, ${faction.food} food, ${techCount} techs`
    );
  }

  if (state.winner) {
    lines.push("", `WINNER: ${state.factions.get(state.winner)?.name}`);
  }

  return lines.join("\n");
}
