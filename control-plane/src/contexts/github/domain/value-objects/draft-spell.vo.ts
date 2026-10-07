export interface DraftSpell {
  readonly from: Date;
  readonly to: Date | null;
}

export const openSpellOf = (
  spells: readonly DraftSpell[],
): DraftSpell | null => {
  const last = spells[spells.length - 1];

  return last && last.to === null ? last : null;
};

export const sameSpells = (
  one: readonly DraftSpell[],
  other: readonly DraftSpell[],
): boolean =>
  one.length === other.length &&
  one.every(
    (each, at) =>
      each.from.getTime() === other[at]?.from.getTime() &&
      (each.to?.getTime() ?? null) === (other[at]?.to?.getTime() ?? null),
  );
