export interface CombatResult {
  readonly attackerWins: boolean;
  readonly remainingAttackers: number;
  readonly remainingDefenders: number;
}

export function resolveCombat(
  attackers: number,
  defenders: number,
  defenderBonus: number = 1.3
): CombatResult {
  const effectiveDefense = Math.floor(defenders * defenderBonus);

  const remainingAttackers = Math.max(0, attackers - effectiveDefense);
  const remainingDefenders = Math.max(0, defenders - attackers);

  return {
    attackerWins: remainingAttackers > 0 && remainingDefenders <= 0,
    remainingAttackers,
    remainingDefenders,
  };
}
