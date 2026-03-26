import type { Troops, GeneralDef, TroopType } from "@xpoch/shared";
import { TROOP_STATS, TRUMP_MAP, TRUMP_BONUS } from "@xpoch/shared";

// === Types ===

export interface BattleResult {
  readonly attackerWins: boolean;
  readonly attackerLosses: Troops;
  readonly defenderLosses: Troops;
  readonly attackerRemaining: Troops;
  readonly defenderRemaining: Troops;
  readonly expGained: number;
  readonly log: readonly string[];
}

// === Constants ===

const TROOP_TYPES: readonly TroopType[] = ["infantry", "cavalry", "archer"];
const BASE_LOSS_RATE = 0.3;
const MIN_LOSS_RATE = 0.1;

// === Helpers ===

export function totalTroops(troops: Troops): number {
  return troops.infantry + troops.cavalry + troops.archer;
}

function troopPowerForType(
  type: TroopType,
  count: number,
  generalAttackBonus: number,
  enemyTroops: Troops,
): number {
  if (count <= 0) return 0;

  const stats = TROOP_STATS[type];
  const basePower = count * stats.attack * (1 + generalAttackBonus);

  const trumpTarget = TRUMP_MAP[type];
  const enemyTotal = totalTroops(enemyTroops);
  if (enemyTotal <= 0) return basePower;

  const trumpedPortion = enemyTroops[trumpTarget] / enemyTotal;
  const normalPortion = 1 - trumpedPortion;
  const effectiveMultiplier = normalPortion + trumpedPortion * TRUMP_BONUS;

  return basePower * effectiveMultiplier;
}

function troopDefenseForType(
  type: TroopType,
  count: number,
  generalDefenseBonus: number,
): number {
  if (count <= 0) return 0;
  const stats = TROOP_STATS[type];
  return count * stats.defense * (1 + generalDefenseBonus);
}

export function calculatePower(
  troops: Troops,
  general: GeneralDef | null,
  trumpTarget: Troops,
): number {
  const attackBonus = general ? general.baseAttack / 100 : 0;

  return TROOP_TYPES.reduce(
    (sum, type) =>
      sum + troopPowerForType(type, troops[type], attackBonus, trumpTarget),
    0,
  );
}

function calculateDefense(
  troops: Troops,
  general: GeneralDef | null,
  terrainDefense: number,
  cityDefense: number,
): number {
  const defenseBonus = general ? general.baseDefense / 100 : 0;

  const troopDef = TROOP_TYPES.reduce(
    (sum, type) => sum + troopDefenseForType(type, troops[type], defenseBonus),
    0,
  );

  const count = totalTroops(troops);
  return troopDef + (count > 0 ? terrainDefense + cityDefense : 0);
}

function computeLosses(
  troops: Troops,
  lossRate: number,
): Troops {
  const clampedRate = Math.max(MIN_LOSS_RATE, Math.min(1, lossRate));
  return {
    infantry: Math.round(troops.infantry * clampedRate),
    cavalry: Math.round(troops.cavalry * clampedRate),
    archer: Math.round(troops.archer * clampedRate),
  };
}

function subtractTroops(a: Troops, b: Troops): Troops {
  return {
    infantry: Math.max(0, a.infantry - b.infantry),
    cavalry: Math.max(0, a.cavalry - b.cavalry),
    archer: Math.max(0, a.archer - b.archer),
  };
}

// === Main ===

export function resolveBattle(
  attacker: { readonly troops: Troops; readonly general: GeneralDef | null },
  defender: {
    readonly troops: Troops;
    readonly general: GeneralDef | null;
    readonly garrison?: Troops;
  },
  terrainDefense: number,
  cityDefense: number,
): BattleResult {
  const log: string[] = [];

  // Combine defender troops with garrison
  const defenderTroops: Troops = defender.garrison
    ? {
        infantry: defender.troops.infantry + defender.garrison.infantry,
        cavalry: defender.troops.cavalry + defender.garrison.cavalry,
        archer: defender.troops.archer + defender.garrison.archer,
      }
    : defender.troops;

  const atkTotal = totalTroops(attacker.troops);
  const defTotal = totalTroops(defenderTroops);

  // Edge case: no troops
  if (atkTotal === 0 && defTotal === 0) {
    return {
      attackerWins: false,
      attackerLosses: { infantry: 0, cavalry: 0, archer: 0 },
      defenderLosses: { infantry: 0, cavalry: 0, archer: 0 },
      attackerRemaining: { infantry: 0, cavalry: 0, archer: 0 },
      defenderRemaining: { infantry: 0, cavalry: 0, archer: 0 },
      expGained: 0,
      log: ["No troops on either side — no battle."],
    };
  }

  if (atkTotal === 0) {
    return {
      attackerWins: false,
      attackerLosses: { infantry: 0, cavalry: 0, archer: 0 },
      defenderLosses: { infantry: 0, cavalry: 0, archer: 0 },
      attackerRemaining: { infantry: 0, cavalry: 0, archer: 0 },
      defenderRemaining: defenderTroops,
      expGained: 0,
      log: ["No attackers — defender wins by default."],
    };
  }

  if (defTotal === 0) {
    return {
      attackerWins: true,
      attackerLosses: { infantry: 0, cavalry: 0, archer: 0 },
      defenderLosses: { infantry: 0, cavalry: 0, archer: 0 },
      attackerRemaining: attacker.troops,
      defenderRemaining: { infantry: 0, cavalry: 0, archer: 0 },
      expGained: 0,
      log: ["No defenders — attacker wins by default."],
    };
  }

  // Calculate power and defense
  const atkPower = calculatePower(
    attacker.troops,
    attacker.general,
    defenderTroops,
  );
  const defPower = calculatePower(
    defenderTroops,
    defender.general,
    attacker.troops,
  );

  const atkDefense = calculateDefense(attacker.troops, attacker.general, 0, 0);
  const defDefense = calculateDefense(
    defenderTroops,
    defender.general,
    terrainDefense,
    cityDefense,
  );

  log.push(
    `Attacker: ${atkTotal} troops (inf=${attacker.troops.infantry}, cav=${attacker.troops.cavalry}, arc=${attacker.troops.archer}), power=${atkPower.toFixed(1)}, defense=${atkDefense.toFixed(1)}`,
  );
  log.push(
    `Defender: ${defTotal} troops (inf=${defenderTroops.infantry}, cav=${defenderTroops.cavalry}, arc=${defenderTroops.archer}), power=${defPower.toFixed(1)}, defense=${defDefense.toFixed(1)}`,
  );

  if (terrainDefense > 0) {
    log.push(`Terrain defense bonus: +${terrainDefense}`);
  }
  if (cityDefense > 0) {
    log.push(`City defense bonus: +${cityDefense}`);
  }

  // Calculate losses: base loss rate = 30% × opposing power / own defense
  const atkLossRate =
    defDefense > 0 ? BASE_LOSS_RATE * (defPower / atkDefense) : MIN_LOSS_RATE;
  const defLossRate =
    atkDefense > 0 ? BASE_LOSS_RATE * (atkPower / defDefense) : MIN_LOSS_RATE;

  const attackerLosses = computeLosses(attacker.troops, atkLossRate);
  const defenderLosses = computeLosses(defenderTroops, defLossRate);

  const attackerRemaining = subtractTroops(attacker.troops, attackerLosses);
  const defenderRemaining = subtractTroops(defenderTroops, defenderLosses);

  log.push(
    `Attacker losses: inf=${attackerLosses.infantry}, cav=${attackerLosses.cavalry}, arc=${attackerLosses.archer} (rate=${(Math.max(MIN_LOSS_RATE, Math.min(1, atkLossRate)) * 100).toFixed(1)}%)`,
  );
  log.push(
    `Defender losses: inf=${defenderLosses.infantry}, cav=${defenderLosses.cavalry}, arc=${defenderLosses.archer} (rate=${(Math.max(MIN_LOSS_RATE, Math.min(1, defLossRate)) * 100).toFixed(1)}%)`,
  );

  // Winner = side with more remaining total power
  const atkRemainingPower = calculatePower(
    attackerRemaining,
    attacker.general,
    defenderRemaining,
  );
  const defRemainingPower = calculatePower(
    defenderRemaining,
    defender.general,
    attackerRemaining,
  );

  const attackerWins = atkRemainingPower > defRemainingPower;

  log.push(
    `Remaining — attacker power=${atkRemainingPower.toFixed(1)}, defender power=${defRemainingPower.toFixed(1)} — ${attackerWins ? "attacker" : "defender"} wins.`,
  );

  // Exp gained by winning general = total enemy losses
  const expGained = attackerWins
    ? totalTroops(defenderLosses)
    : totalTroops(attackerLosses);

  return {
    attackerWins,
    attackerLosses,
    defenderLosses,
    attackerRemaining,
    defenderRemaining,
    expGained,
    log,
  };
}
