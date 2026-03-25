import type { Faction, Tile } from "@xpoch/shared";

interface FactionPanelProps {
  readonly factions: ReadonlyMap<string, Faction>;
  readonly tiles: ReadonlyMap<string, Tile>;
}

export function FactionPanel({ factions, tiles }: FactionPanelProps) {
  const factionStats = [...factions.values()].map((f) => {
    const ownedTiles = [...tiles.values()].filter((t) => t.owner === f.id);
    const totalArmy = ownedTiles.reduce((sum, t) => sum + t.army, 0);
    return { ...f, tileCount: ownedTiles.length, totalArmy };
  });

  return (
    <div className="p-3 space-y-3">
      <h3 className="text-lg font-bold text-amber-400">Factions</h3>
      {factionStats.map((f) => (
        <div
          key={f.id}
          className={`p-2 rounded border ${f.alive ? "border-gray-600" : "border-red-900 opacity-40"}`}
        >
          <div className="flex items-center gap-2 mb-1">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: f.color }}
            />
            <span className="font-bold">{f.name}</span>
            {!f.alive && <span className="text-red-400 text-xs">ELIMINATED</span>}
          </div>
          <div className="grid grid-cols-2 gap-1 text-xs text-gray-400">
            <span>Tiles: {f.tileCount}</span>
            <span>Army: {f.totalArmy}</span>
            <span>Gold: {f.gold}</span>
            <span>Food: {f.food}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
