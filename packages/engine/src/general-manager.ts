import type { GameState, GeneralId, FactionId, General, GeneralDef } from "@xpoch/shared";
import {
  GENERAL_POOL,
  GENERAL_RESPAWN_TICKS,
  EXP_PER_LEVEL,
  GENERAL_MAX_LEVEL,
} from "@xpoch/shared";

// === Seeded RNG ===

function createRng(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleArray<T>(arr: readonly T[], rng: () => number): readonly T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = result[i];
    result[i] = result[j];
    result[j] = tmp;
  }
  return result;
}

// === Public API ===

export function getGeneralDef(generalId: GeneralId): GeneralDef | undefined {
  return GENERAL_POOL.find((g) => g.id === generalId);
}

export function assignGenerals(
  factionIds: readonly FactionId[],
  generalsPerFaction: number,
  seed: number,
): ReadonlyMap<GeneralId, General> {
  const rng = createRng(seed);
  const shuffled = shuffleArray(GENERAL_POOL, rng);

  const totalNeeded = factionIds.length * generalsPerFaction;
  if (totalNeeded > shuffled.length) {
    throw new Error(
      `Not enough generals in pool (${shuffled.length}) for ${factionIds.length} factions × ${generalsPerFaction} each`,
    );
  }

  const generals = new Map<GeneralId, General>();
  let poolIndex = 0;

  for (const factionId of factionIds) {
    for (let i = 0; i < generalsPerFaction; i++) {
      const def = shuffled[poolIndex];
      poolIndex += 1;

      const general: General = {
        id: def.id,
        defId: def.id,
        factionId,
        name: def.name,
        level: 1,
        exp: 0,
        alive: true,
        respawnTick: null,
      };
      generals.set(general.id, general);
    }
  }

  return generals;
}

export function processRespawns(state: GameState): GameState {
  let changed = false;
  const newGenerals = new Map(state.generals);

  for (const [id, general] of state.generals) {
    if (
      !general.alive &&
      general.respawnTick !== null &&
      general.respawnTick <= state.tick
    ) {
      const newLevel = Math.max(1, general.level - 1);
      newGenerals.set(id, {
        ...general,
        alive: true,
        respawnTick: null,
        level: newLevel,
        exp: 0,
      });
      changed = true;
    }
  }

  return changed ? { ...state, generals: newGenerals } : state;
}

export function awardExp(
  state: GameState,
  generalId: GeneralId,
  exp: number,
): GameState {
  const general = state.generals.get(generalId);
  if (!general || !general.alive) return state;

  const newExp = general.exp + exp;
  const expThreshold = EXP_PER_LEVEL * general.level;

  const levelsGained =
    general.level >= GENERAL_MAX_LEVEL
      ? 0
      : Math.floor(newExp / expThreshold);

  const newLevel = Math.min(GENERAL_MAX_LEVEL, general.level + levelsGained);
  const remainingExp =
    levelsGained > 0 ? newExp - levelsGained * expThreshold : newExp;

  const newGenerals = new Map(state.generals);
  newGenerals.set(generalId, {
    ...general,
    exp: remainingExp,
    level: newLevel,
  });

  return { ...state, generals: newGenerals };
}

export function killGeneral(
  state: GameState,
  generalId: GeneralId,
): GameState {
  const general = state.generals.get(generalId);
  if (!general) return state;

  const newGenerals = new Map(state.generals);
  newGenerals.set(generalId, {
    ...general,
    alive: false,
    respawnTick: state.tick + GENERAL_RESPAWN_TICKS,
  });

  return { ...state, generals: newGenerals };
}
