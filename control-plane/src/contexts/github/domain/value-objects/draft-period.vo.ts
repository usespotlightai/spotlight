export interface DraftPeriod {
  readonly from: Date;
  readonly to: Date | null;
}

export const openPeriodOf = (
  periods: readonly DraftPeriod[],
): DraftPeriod | null => {
  const last = periods[periods.length - 1];

  return last && last.to === null ? last : null;
};

export const samePeriods = (
  one: readonly DraftPeriod[],
  other: readonly DraftPeriod[],
): boolean =>
  one.length === other.length &&
  one.every(
    (each, at) =>
      each.from.getTime() === other[at]?.from.getTime() &&
      (each.to?.getTime() ?? null) === (other[at]?.to?.getTime() ?? null),
  );
