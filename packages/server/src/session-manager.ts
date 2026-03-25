import type { GameState, FactionId, AIAdapter } from "@xpoch/shared";
import { createInitialState, type FactionConfig } from "@xpoch/engine";
import { MAP_SIZE } from "@xpoch/shared";
import { GameLoop } from "./game-loop";

export interface Session {
  readonly id: string;
  readonly loop: GameLoop;
  readonly createdAt: Date;
}

export class SessionManager {
  private sessions = new Map<string, Session>();

  createSession(
    factionConfigs: FactionConfig[],
    adapterFactory: (config: FactionConfig) => AIAdapter,
    onUpdate: (sessionId: string, state: GameState) => void
  ): Session {
    const id = crypto.randomUUID();
    const seed = Date.now();
    const initialState = createInitialState(MAP_SIZE, seed, factionConfigs);

    const adapters = new Map<FactionId, AIAdapter>();
    for (const config of factionConfigs) {
      adapters.set(config.id, adapterFactory(config));
    }

    const loop = new GameLoop(initialState, adapters, (state) =>
      onUpdate(id, state)
    );

    const session: Session = { id, loop, createdAt: new Date() };
    this.sessions.set(id, session);
    return session;
  }

  getSession(id: string): Session | undefined {
    return this.sessions.get(id);
  }

  listSessions(): { id: string; tick: number; running: boolean }[] {
    return [...this.sessions.values()].map((s) => ({
      id: s.id,
      tick: s.loop.getState().tick,
      running: s.loop.isRunning(),
    }));
  }

  deleteSession(id: string): boolean {
    const session = this.sessions.get(id);
    if (!session) return false;
    session.loop.stop();
    this.sessions.delete(id);
    return true;
  }
}
