import { useState, useEffect } from "react";

export interface PlayerSetup {
  readonly name: string;
  readonly modelProvider: string;
  readonly apiKey: string;
  readonly model: string;
  readonly color: string;
}

interface ProviderInfo {
  readonly id: string;
  readonly name: string;
  readonly defaultModel: string;
}

const COLORS = ["#8B5CF6", "#10B981", "#3B82F6", "#F59E0B", "#EF4444", "#EC4899", "#06B6D4", "#84CC16"];

const DEFAULT_PLAYERS: PlayerSetup[] = [
  { name: "Claude Empire", modelProvider: "anthropic", apiKey: "", model: "", color: COLORS[0] },
  { name: "GPT Republic", modelProvider: "openai", apiKey: "", model: "", color: COLORS[1] },
  { name: "Gemini Dynasty", modelProvider: "gemini", apiKey: "", model: "", color: COLORS[2] },
];

const STORAGE_KEY = "xpoch_player_config";

function loadSavedConfig(): PlayerSetup[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch { /* ignore */ }
  return DEFAULT_PLAYERS;
}

function saveConfig(players: PlayerSetup[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(players));
}

interface SetupPanelProps {
  readonly onStart: (players: PlayerSetup[], tickInterval: number) => void;
}

export function SetupPanel({ onStart }: SetupPanelProps) {
  const [players, setPlayers] = useState<PlayerSetup[]>(loadSavedConfig);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [tickInterval, setTickInterval] = useState(8);
  const [showKeys, setShowKeys] = useState(false);

  useEffect(() => {
    fetch("/api/providers")
      .then((r) => r.json())
      .then(setProviders)
      .catch(() => {});
  }, []);

  const updatePlayer = (index: number, updates: Partial<PlayerSetup>) => {
    const next = players.map((p, i) => (i === index ? { ...p, ...updates } : p));
    setPlayers(next);
    saveConfig(next);
  };

  const addPlayer = () => {
    if (players.length >= 6) return;
    const next = [
      ...players,
      {
        name: `Faction ${players.length + 1}`,
        modelProvider: "mock",
        apiKey: "",
        model: "",
        color: COLORS[players.length % COLORS.length],
      },
    ];
    setPlayers(next);
    saveConfig(next);
  };

  const removePlayer = (index: number) => {
    if (players.length <= 2) return;
    const next = players.filter((_, i) => i !== index);
    setPlayers(next);
    saveConfig(next);
  };

  const handleProviderChange = (index: number, providerId: string) => {
    const provider = providers.find((p) => p.id === providerId);
    updatePlayer(index, {
      modelProvider: providerId,
      model: provider?.defaultModel ?? "",
    });
  };

  const canStart = players.length >= 2 && players.every((p) =>
    p.name.trim() && (p.modelProvider === "mock" || p.apiKey.trim())
  );

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-amber-400 tracking-widest mb-2">XPOCH</h1>
          <p className="text-gray-400">AI Civilization Arena — Configure your players</p>
        </div>

        <div className="space-y-4 mb-6">
          {players.map((player, i) => (
            <div key={i} className="bg-gray-900 border border-gray-700 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-3">
                <input
                  type="color"
                  value={player.color}
                  onChange={(e) => updatePlayer(i, { color: e.target.value })}
                  className="w-8 h-8 rounded cursor-pointer bg-transparent border-0"
                />
                <input
                  type="text"
                  value={player.name}
                  onChange={(e) => updatePlayer(i, { name: e.target.value })}
                  className="flex-1 bg-gray-800 text-white px-3 py-1.5 rounded border border-gray-600 focus:border-amber-500 outline-none"
                  placeholder="Faction name"
                />
                {players.length > 2 && (
                  <button
                    onClick={() => removePlayer(i)}
                    className="text-red-400 hover:text-red-300 text-sm px-2"
                  >
                    Remove
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">AI Provider</label>
                  <select
                    value={player.modelProvider}
                    onChange={(e) => handleProviderChange(i, e.target.value)}
                    className="w-full bg-gray-800 text-white px-3 py-1.5 rounded border border-gray-600 focus:border-amber-500 outline-none text-sm"
                  >
                    {providers.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs text-gray-500 block mb-1">Model</label>
                  <input
                    type="text"
                    value={player.model || providers.find((p) => p.id === player.modelProvider)?.defaultModel || ""}
                    onChange={(e) => updatePlayer(i, { model: e.target.value })}
                    className="w-full bg-gray-800 text-white px-3 py-1.5 rounded border border-gray-600 focus:border-amber-500 outline-none text-sm"
                    placeholder="Default model"
                  />
                </div>
              </div>

              {player.modelProvider !== "mock" && (
                <div className="mt-3">
                  <label className="text-xs text-gray-500 block mb-1">API Key</label>
                  <input
                    type={showKeys ? "text" : "password"}
                    value={player.apiKey}
                    onChange={(e) => updatePlayer(i, { apiKey: e.target.value })}
                    className="w-full bg-gray-800 text-white px-3 py-1.5 rounded border border-gray-600 focus:border-amber-500 outline-none text-sm font-mono"
                    placeholder="sk-..."
                  />
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between mb-6">
          {players.length < 6 ? (
            <button
              onClick={addPlayer}
              className="text-sm text-gray-400 hover:text-amber-400 transition"
            >
              + Add Player
            </button>
          ) : <div />}
          <div className="flex items-center gap-3 ml-auto">
            <label className="text-xs text-gray-500">
              <input
                type="checkbox"
                checked={showKeys}
                onChange={(e) => setShowKeys(e.target.checked)}
                className="mr-1"
              />
              Show keys
            </label>
            <label className="text-xs text-gray-500">
              Tick:
              <input
                type="number"
                value={tickInterval}
                onChange={(e) => setTickInterval(Math.max(3, Number(e.target.value)))}
                className="ml-1 w-12 bg-gray-800 text-white px-1 py-0.5 rounded border border-gray-600 text-center text-xs"
                min={3}
                max={30}
              />s
            </label>
          </div>
        </div>

        <button
          onClick={() => onStart(players, tickInterval * 1000)}
          disabled={!canStart}
          className="w-full py-3 bg-amber-600 hover:bg-amber-500 disabled:bg-gray-700 disabled:text-gray-500 text-black font-bold rounded-lg text-lg transition"
        >
          Start Battle
        </button>

        {!canStart && (
          <p className="text-center text-red-400 text-sm mt-2">
            Each non-mock player needs a name and API key
          </p>
        )}
      </div>
    </div>
  );
}
