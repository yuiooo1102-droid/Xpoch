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
    const cities = [...state.cities.values()].filter((c) => c.factionId === faction.id);
    const armies = [...state.armies.values()].filter((a) => a.factionId === faction.id);
    const generals = [...state.generals.values()].filter((g) => g.factionId === faction.id);
    const techCount = faction.techs.length;
    const res = faction.resources;

    lines.push(
      `${faction.name}: ${cities.length} cities, ${armies.length} armies, ${generals.length} generals, G:${res.gold} F:${res.food} W:${res.wood} I:${res.iron}, ${techCount} techs`
    );
  }

  if (state.winner) {
    lines.push("", `WINNER: ${state.factions.get(state.winner)?.name}`);
  }

  return lines.join("\n");
}
