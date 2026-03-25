import type { GameState, FactionId, AIAdapter, TurnDecision } from "@xpoch/shared";
import { executeTurnDecision, processEconomy, checkVictory, advanceTick, addLogEntry } from "@xpoch/engine";

export class GameLoop {
  private state: GameState;
  private adapters: ReadonlyMap<FactionId, AIAdapter>;
  private onUpdate: (state: GameState) => void;
  private running = false;
  private intervalId: ReturnType<typeof setInterval> | null = null;

  constructor(
    initialState: GameState,
    adapters: ReadonlyMap<FactionId, AIAdapter>,
    onUpdate: (state: GameState) => void,
  ) {
    this.state = initialState;
    this.adapters = adapters;
    this.onUpdate = onUpdate;
  }

  getState(): GameState {
    return this.state;
  }

  isRunning(): boolean {
    return this.running;
  }

  async tick(): Promise<void> {
    if (this.state.winner) return;

    const winner = checkVictory(this.state);
    if (winner) {
      this.state = { ...this.state, winner };
      this.state = addLogEntry(
        this.state,
        `${this.state.factions.get(winner)?.name} has WON the game!`,
        "system",
        [winner],
      );
      this.onUpdate(this.state);
      this.stop();
      return;
    }

    const aliveFactions = [...this.state.factions.values()].filter((f) => f.alive);

    const decisionPromises = aliveFactions.map(async (faction) => {
      const adapter = this.adapters.get(faction.id);
      if (!adapter) {
        return emptyDecision(faction.id);
      }
      try {
        return await adapter.decideActions(this.state, faction.id);
      } catch (err) {
        console.error(`AI error for ${faction.name}:`, err);
        return emptyDecision(faction.id);
      }
    });

    const allDecisions = await Promise.all(decisionPromises);

    let newState = this.state;
    for (const decision of allDecisions) {
      newState = executeTurnDecision(newState, decision);
    }

    newState = processEconomy(newState);
    newState = advanceTick(newState);

    this.state = newState;
    this.onUpdate(this.state);
  }

  start(intervalMs: number): void {
    if (this.running) return;
    this.running = true;
    this.intervalId = setInterval(() => {
      this.tick().catch(console.error);
    }, intervalMs);
  }

  stop(): void {
    this.running = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}

function emptyDecision(factionId: FactionId): TurnDecision {
  return {
    factionId,
    military: [],
    cities: [],
    research: null,
    diplomacy: [],
  };
}
