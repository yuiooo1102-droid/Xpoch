import type { Faction, Tile, Unit, City, UnitType } from "@xpoch/shared";

interface FactionPanelProps {
  readonly factions: ReadonlyMap<string, Faction>;
  readonly tiles: ReadonlyMap<string, Tile>;
  readonly units: ReadonlyMap<string, Unit>;
  readonly cities: ReadonlyMap<string, City>;
}

const UNIT_TYPE_LABELS: Record<UnitType, string> = {
  infantry: "Inf",
  cavalry: "Cav",
  artillery: "Art",
  scout: "Sct",
  settler: "Set",
};

interface FactionSummary {
  readonly faction: Faction;
  readonly cityNames: readonly string[];
  readonly unitCounts: Readonly<Record<UnitType, number>>;
  readonly totalUnits: number;
  readonly resourceSet: ReadonlySet<string>;
}

function buildFactionSummary(
  faction: Faction,
  cities: ReadonlyMap<string, City>,
  units: ReadonlyMap<string, Unit>,
  tiles: ReadonlyMap<string, Tile>
): FactionSummary {
  const cityNames = [...cities.values()]
    .filter((c) => c.factionId === faction.id)
    .map((c) => (c.isCapital ? `${c.name} (cap)` : c.name));

  const unitCounts: Record<UnitType, number> = {
    infantry: 0,
    cavalry: 0,
    artillery: 0,
    scout: 0,
    settler: 0,
  };
  let totalUnits = 0;
  for (const u of units.values()) {
    if (u.factionId === faction.id) {
      unitCounts[u.type] += 1;
      totalUnits += 1;
    }
  }

  const resourceSet = new Set<string>();
  for (const t of tiles.values()) {
    if (t.naturalResource && (t.cityId !== null || t.isCityOutskirt !== null)) {
      const ownerCity = t.cityId
        ? cities.get(t.cityId)
        : t.isCityOutskirt
          ? cities.get(t.isCityOutskirt)
          : null;
      if (ownerCity?.factionId === faction.id) {
        resourceSet.add(t.naturalResource);
      }
    }
  }

  return { faction, cityNames, unitCounts, totalUnits, resourceSet };
}

export function FactionPanel({ factions, tiles, units, cities }: FactionPanelProps) {
  const summaries = [...factions.values()].map((f) =>
    buildFactionSummary(f, cities, units, tiles)
  );

  return (
    <div className="p-3 space-y-3">
      <h3 className="text-lg font-bold text-amber-400">Factions</h3>
      {summaries.map((s) => (
        <FactionCard key={s.faction.id} summary={s} />
      ))}
    </div>
  );
}

function FactionCard({ summary }: { readonly summary: FactionSummary }) {
  const { faction, cityNames, unitCounts, totalUnits, resourceSet } = summary;

  const unitBreakdown = (Object.entries(unitCounts) as [UnitType, number][])
    .filter(([, count]) => count > 0)
    .map(([type, count]) => `${UNIT_TYPE_LABELS[type]}:${count}`)
    .join(" ");

  return (
    <div
      className={`p-2 rounded border ${faction.alive ? "border-gray-600" : "border-red-900 opacity-40"}`}
    >
      <div className="flex items-center gap-2 mb-1">
        <div
          className="w-3 h-3 rounded-full"
          style={{ backgroundColor: faction.color }}
        />
        <span className="font-bold">{faction.name}</span>
        {!faction.alive && <span className="text-red-400 text-xs">ELIMINATED</span>}
      </div>

      {/* Cities */}
      <div className="text-xs text-gray-400 mb-1">
        <span className="text-gray-300">Cities ({cityNames.length}):</span>{" "}
        {cityNames.length > 0 ? cityNames.join(", ") : "none"}
      </div>

      {/* Units */}
      <div className="text-xs text-gray-400 mb-1">
        <span className="text-gray-300">Units ({totalUnits}):</span>{" "}
        {unitBreakdown || "none"}
      </div>

      {/* Economy */}
      <div className="grid grid-cols-3 gap-1 text-xs text-gray-400 mb-1">
        <span>Gold: {faction.gold}</span>
        <span>Food: {faction.food}</span>
        <span>Res: {faction.research}</span>
      </div>

      {/* Techs */}
      <div className="text-xs text-gray-400 mb-1">
        <span className="text-gray-300">Techs:</span> {faction.techs.length} researched
      </div>

      {/* Resources */}
      {resourceSet.size > 0 && (
        <div className="text-xs text-gray-400">
          <span className="text-gray-300">Resources:</span>{" "}
          {[...resourceSet].join(", ")}
        </div>
      )}
    </div>
  );
}
