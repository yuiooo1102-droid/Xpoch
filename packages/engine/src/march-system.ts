import type { GameState, ArmyId, HexCoord } from "@xpoch/shared";
import { hexDistance } from "@xpoch/shared";
import { getGeneralDef } from "./general-manager";

// === Helpers ===

function moveToward(from: HexCoord, to: HexCoord, steps: number): HexCoord {
  const dist = hexDistance(from, to);
  if (dist === 0 || steps <= 0) return from;

  if (steps >= dist) return to;

  // Move along the hex line: interpolate and round to nearest hex
  const t = steps / dist;
  const fq = from.q + (to.q - from.q) * t;
  const fr = from.r + (to.r - from.r) * t;

  // Cube coordinate rounding for hex
  const fs = -fq - fr;
  let rq = Math.round(fq);
  let rr = Math.round(fr);
  const rs = Math.round(fs);

  const dq = Math.abs(rq - fq);
  const dr = Math.abs(rr - fr);
  const ds = Math.abs(rs - fs);

  if (dq > dr && dq > ds) {
    rq = -rr - rs;
  } else if (dr > ds) {
    rr = -rq - rs;
  }
  // else rs is largest, but we only need q and r

  return { q: rq, r: rr };
}

// === Public API ===

export function estimateMarchTime(
  from: HexCoord,
  to: HexCoord,
  speed: number,
): number {
  if (speed <= 0) return Infinity;
  const dist = hexDistance(from, to);
  return Math.ceil(dist / speed);
}

export function startMarch(
  state: GameState,
  armyId: ArmyId,
  target: HexCoord,
): GameState {
  const army = state.armies.get(armyId);
  if (!army) return state;

  const newArmies = new Map(state.armies);
  newArmies.set(armyId, {
    ...army,
    target,
    state: "marching" as const,
  });

  return { ...state, armies: newArmies };
}

export function processMarches(state: GameState): GameState {
  let changed = false;
  const newArmies = new Map(state.armies);

  for (const [id, army] of state.armies) {
    if (army.state !== "marching" || army.target === null) continue;

    const general = state.generals.get(army.generalId);
    const generalDef = general ? getGeneralDef(general.defId) : undefined;
    const speed = generalDef ? generalDef.baseSpeed : 1;

    const newCoord = moveToward(army.coord, army.target, speed);
    const arrived = hexDistance(newCoord, army.target) === 0;

    newArmies.set(id, {
      ...army,
      coord: newCoord,
      state: arrived ? ("idle" as const) : ("marching" as const),
      target: arrived ? null : army.target,
    });
    changed = true;
  }

  return changed ? { ...state, armies: newArmies } : state;
}
