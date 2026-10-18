export const ORIGINAL_OUTCOMES = [
  'accepted',
  'sent-back',
  'asked',
  'failed',
  'other',
] as const;

export type OriginalOutcome = (typeof ORIGINAL_OUTCOMES)[number];

const UNKNOWN_ORIGIN = 'unknown';

const MIN_ENTRIES_TO_WARN = 6;

const DOMINANT_RATE = 2 / 3;

export interface ComposedOriginal {
  readonly outcome: OriginalOutcome;
  readonly origin: string | null;
  readonly endedAt: Date | null;
}

export interface OutcomeCount {
  readonly outcome: OriginalOutcome;
  readonly count: number;
}

interface OriginCount {
  readonly origin: string;
  readonly count: number;
}

interface BalanceWarning {
  readonly dominant: OriginalOutcome;
  readonly count: number;
  readonly entries: number;
}

export interface SetComposition {
  readonly entries: number;
  readonly outcomes: readonly OutcomeCount[];
  readonly origins: readonly OriginCount[];
  readonly oldest: Date | null;
  readonly median: Date | null;
  readonly newest: Date | null;
  readonly balanceWarning: BalanceWarning | null;
}

export const originalOutcomeOf = (
  originalOutcomes: ReadonlyMap<string, OriginalOutcome>,
  runId: string,
): OriginalOutcome => originalOutcomes.get(runId) ?? 'other';

const medianOf = (times: readonly number[]): number | null => {
  if (times.length === 0) {
    return null;
  }

  const middle = Math.floor(times.length / 2);

  return times.length % 2 === 1
    ? times[middle]
    : (times[middle - 1] + times[middle]) / 2;
};

const dateOf = (time: number | null | undefined): Date | null =>
  time === null || time === undefined ? null : new Date(time);

const warningOf = (
  outcomes: readonly OutcomeCount[],
  entries: number,
): BalanceWarning | null => {
  if (entries < MIN_ENTRIES_TO_WARN) {
    return null;
  }

  const dominant = outcomes.find(
    (each) => each.outcome !== 'other' && each.count > entries * DOMINANT_RATE,
  );

  return dominant
    ? { dominant: dominant.outcome, count: dominant.count, entries }
    : null;
};

export const countsOf = (
  outcomes: readonly OriginalOutcome[],
): readonly OutcomeCount[] =>
  ORIGINAL_OUTCOMES.map((outcome) => ({
    outcome,
    count: outcomes.filter((each) => each === outcome).length,
  }));

export const compositionOf = (
  originals: readonly ComposedOriginal[],
): SetComposition => {
  const outcomes = countsOf(originals.map((each) => each.outcome));
  const origins = new Map<string, number>();

  for (const original of originals) {
    const origin = original.origin ?? UNKNOWN_ORIGIN;
    origins.set(origin, (origins.get(origin) ?? 0) + 1);
  }

  const times = originals
    .flatMap((each) => (each.endedAt ? [each.endedAt.getTime()] : []))
    .sort((one, other) => one - other);

  return {
    entries: originals.length,
    outcomes,
    origins: [...origins]
      .map(([origin, count]) => ({ origin, count }))
      .sort(
        (one, other) =>
          other.count - one.count || one.origin.localeCompare(other.origin),
      ),
    oldest: dateOf(times[0]),
    median: dateOf(medianOf(times)),
    newest: dateOf(times[times.length - 1]),
    balanceWarning: warningOf(outcomes, originals.length),
  };
};
