const ORIGINAL_OUTCOMES = [
  'accepted',
  'sent-back',
  'asked',
  'failed',
  'other',
] as const;

export type OriginalOutcome = (typeof ORIGINAL_OUTCOMES)[number];

export interface OutcomeCount {
  readonly outcome: OriginalOutcome;
  readonly count: number;
}

export const originalOutcomeOf = (
  originalOutcomes: ReadonlyMap<string, OriginalOutcome>,
  runId: string,
): OriginalOutcome => originalOutcomes.get(runId) ?? 'other';

export const countsOf = (
  outcomes: readonly OriginalOutcome[],
): readonly OutcomeCount[] =>
  ORIGINAL_OUTCOMES.map((outcome) => ({
    outcome,
    count: outcomes.filter((each) => each === outcome).length,
  }));
