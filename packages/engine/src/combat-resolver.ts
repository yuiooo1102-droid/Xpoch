import type { Unit, UnitType } from "@xpoch/shared";
import { TRUMP } from "@xpoch/shared";

export interface CombatResult {
  readonly attackerWins: boolean;
  readonly survivingAttackers: readonly Unit[];
  readonly survivingDefenders: readonly Unit[];
  readonly attackerLosses: readonly Unit[];
  readonly defenderLosses: readonly Unit[];
  readonly log: readonly string[];
}

interface MatchupResult {
  readonly attackerSurvived: boolean;
  readonly defenderSurvived: boolean;
  readonly attackerDamage: number;
  readonly defenderDamage: number;
  readonly logEntry: string;
}

function hasTrumpOver(attackerType: UnitType, defenderType: UnitType): boolean {
  return TRUMP[attackerType] === defenderType;
}

function resolveMatchup(attacker: Unit, defender: Unit): MatchupResult {
  const atkStr = attacker.strength;
  const defStr = defender.strength;

  const attackerTrumps = hasTrumpOver(attacker.type, defender.type);
  const defenderTrumps = hasTrumpOver(defender.type, attacker.type);

  let attackerDamageTaken: number;
  let defenderDamageTaken: number;

  if (attackerTrumps) {
    // Attacker deals damage first
    defenderDamageTaken = atkStr;
    const defenderDies = defenderDamageTaken >= defStr;
    attackerDamageTaken = defenderDies ? 0 : defStr;
  } else if (defenderTrumps) {
    // Defender deals damage first
    attackerDamageTaken = defStr;
    const attackerDies = attackerDamageTaken >= atkStr;
    defenderDamageTaken = attackerDies ? 0 : atkStr;
  } else {
    // Simultaneous damage
    attackerDamageTaken = defStr;
    defenderDamageTaken = atkStr;
  }

  const attackerSurvived = attackerDamageTaken < atkStr;
  const defenderSurvived = defenderDamageTaken < defStr;

  const trumpNote = attackerTrumps
    ? ` (${attacker.type} trumps ${defender.type})`
    : defenderTrumps
      ? ` (${defender.type} trumps ${attacker.type})`
      : "";

  const logEntry =
    `${attacker.type}[str=${atkStr}] vs ${defender.type}[str=${defStr}]${trumpNote}: ` +
    `attacker ${attackerSurvived ? "survives" : "killed"}, ` +
    `defender ${defenderSurvived ? "survives" : "killed"}`;

  return {
    attackerSurvived,
    defenderSurvived,
    attackerDamage: attackerDamageTaken,
    defenderDamage: defenderDamageTaken,
    logEntry,
  };
}

function sortByStrengthDesc(units: readonly Unit[]): readonly Unit[] {
  return [...units].sort((a, b) => b.strength - a.strength);
}

/**
 * Resolve combat between attacking and defending units at a hex.
 *
 * Rules:
 * 1. Units are matched 1v1 from strongest to weakest
 * 2. Trump advantage: if A trumps B, A deals damage first. If A kills B, A takes 0 damage.
 *    (infantry trumps cavalry, cavalry trumps artillery, artillery trumps infantry)
 * 3. Both sides deal damage = their strength simultaneously (unless trumped dead first)
 * 4. Unit dies when damage >= strength
 * 5. After all matchups, side with more surviving total strength wins
 * 6. Tie -> defender wins
 *
 * @param attackers - attacking units
 * @param defenders - defending units
 * @param terrainDefenseBonus - from terrain (forest +1, mountain +2 per unit)
 * @param cityDefenseBonus - from city (+4) or capital (+8) or walls (+4 more)
 */
export function resolveCombat(
  attackers: readonly Unit[],
  defenders: readonly Unit[],
  terrainDefenseBonus: number,
  cityDefenseBonus: number,
): CombatResult {
  if (attackers.length === 0) {
    return {
      attackerWins: false,
      survivingAttackers: [],
      survivingDefenders: [...defenders],
      attackerLosses: [],
      defenderLosses: [],
      log: ["No attackers present — defender wins by default."],
    };
  }

  if (defenders.length === 0) {
    return {
      attackerWins: true,
      survivingAttackers: [...attackers],
      survivingDefenders: [],
      attackerLosses: [],
      defenderLosses: [],
      log: ["No defenders present — attacker wins by default."],
    };
  }

  const sortedAttackers = sortByStrengthDesc(attackers);
  const sortedDefenders = sortByStrengthDesc(defenders);

  const survivingAttackers: Unit[] = [];
  const survivingDefenders: Unit[] = [];
  const attackerLosses: Unit[] = [];
  const defenderLosses: Unit[] = [];
  const log: string[] = [];

  const matchCount = Math.max(sortedAttackers.length, sortedDefenders.length);

  for (let i = 0; i < matchCount; i++) {
    const attacker: Unit | undefined = sortedAttackers[i];
    const defender: Unit | undefined = sortedDefenders[i];

    if (attacker === undefined && defender !== undefined) {
      // Extra defender with no opponent — survives
      survivingDefenders.push(defender);
      log.push(`${defender.type}[str=${defender.strength}] has no opponent — survives.`);
      continue;
    }

    if (defender === undefined && attacker !== undefined) {
      // Extra attacker with no opponent — survives
      survivingAttackers.push(attacker);
      log.push(`${attacker.type}[str=${attacker.strength}] has no opponent — survives.`);
      continue;
    }

    if (attacker === undefined || defender === undefined) {
      continue;
    }

    const result = resolveMatchup(attacker, defender);
    log.push(result.logEntry);

    if (result.attackerSurvived) {
      survivingAttackers.push(attacker);
    } else {
      attackerLosses.push(attacker);
    }

    if (result.defenderSurvived) {
      survivingDefenders.push(defender);
    } else {
      defenderLosses.push(defender);
    }
  }

  // Determine winner based on surviving total strength
  const attackerTotalStrength = survivingAttackers.reduce(
    (sum, u) => sum + u.strength,
    0,
  );
  // City/terrain bonuses only apply while defenders still hold the position
  const hasDefenders = survivingDefenders.length > 0;
  const defenderTotalStrength =
    survivingDefenders.reduce((sum, u) => sum + u.strength, 0) +
    (hasDefenders ? terrainDefenseBonus * survivingDefenders.length : 0) +
    (hasDefenders ? cityDefenseBonus : 0);

  const attackerWins = attackerTotalStrength > defenderTotalStrength;

  log.push(
    `Result: attacker strength=${attackerTotalStrength}, ` +
    `defender strength=${defenderTotalStrength} ` +
    `(terrain bonus=${terrainDefenseBonus}/unit, city bonus=${cityDefenseBonus}) — ` +
    `${attackerWins ? "attacker" : "defender"} wins.`,
  );

  return {
    attackerWins,
    survivingAttackers,
    survivingDefenders,
    attackerLosses,
    defenderLosses,
    log,
  };
}
