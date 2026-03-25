import type { LogEntry } from "@xpoch/shared";

interface BattleLogProps {
  readonly entries: readonly LogEntry[];
}

export function BattleLog({ entries }: BattleLogProps) {
  const recent = entries.slice(-50).reverse();

  return (
    <div className="h-full overflow-y-auto p-3 space-y-1 text-sm">
      <h3 className="text-lg font-bold mb-2 text-amber-400">Battle Log</h3>
      {recent.map((entry, i) => (
        <div key={i} className="text-gray-300 border-l-2 border-gray-700 pl-2">
          <span className="text-gray-500 text-xs mr-2">T{entry.tick}</span>
          {entry.message}
        </div>
      ))}
      {recent.length === 0 && (
        <div className="text-gray-500 italic">Waiting for events...</div>
      )}
    </div>
  );
}
