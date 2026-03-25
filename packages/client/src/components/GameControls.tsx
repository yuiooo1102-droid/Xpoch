interface GameControlsProps {
  readonly tick: number;
  readonly sessionId: string | null;
  readonly winner: string | null;
  readonly factionName?: string;
  readonly onCreateSession: () => void;
}

export function GameControls({
  tick,
  sessionId,
  winner,
  factionName,
  onCreateSession,
}: GameControlsProps) {
  return (
    <div className="flex items-center justify-between p-3 bg-gray-900 border-b border-gray-700">
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-bold text-amber-400 tracking-wider">XPOCH</h1>
        {sessionId && (
          <span className="text-sm text-gray-400">
            Tick {tick}
          </span>
        )}
      </div>

      <div className="flex items-center gap-3">
        {winner && (
          <span className="text-green-400 font-bold animate-pulse">
            {factionName} WINS!
          </span>
        )}
        {!sessionId && (
          <button
            onClick={onCreateSession}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-black font-bold rounded transition"
          >
            New Game
          </button>
        )}
      </div>
    </div>
  );
}
