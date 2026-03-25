import type { GameState, FactionId, AIAdapter } from "@xpoch/shared";
import { executeAction, processEconomy, checkVictory, advanceTick, addLogEntry } from "@xpoch/engine";

export class GameLoop {
  private state: GameState;
  private adapters: ReadonlyMap<FactionId, AIAdapter>;
  private onUpdate: (state: GameState) => void;
  private running = false;
  private intervalId: ReturnType<typeof setInterval> | null = null;

  constructor(
    initialState: GameState,
    adapters: ReadonlyMap<FactionId, AIAdapter>,
    onUpdate: (state: GameState) => void
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
      this.state = addLogEntry(this.state, `${this.state.factions.get(winner)?.name} has WON the game!`, [winner]);
      this.onUpdate(this.state);
      this.stop();
      return;
    }

    const aliveFactions = [...this.state.factions.values()].filter((f) => f.alive);

    const actionPromises = aliveFactions.map(async (faction) => {
      const adapter = this.adapters.get(faction.id);
      if (!adapter) return [];
      try {
        return await adapter.decideActions(this.state, faction.id);
      } catch (err) {
        console.error(`AI error for ${faction.name}:`, err);
        return [{ factionId: faction.id, type: "pass" as const }];
      }
    });

    const allActions = await Promise.all(actionPromises);

    let newState = this.state;
    for (const factionActions of allActions) {
      for (const action of factionActions) {
        newState = executeAction(newState, action);
      }
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
