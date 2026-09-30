export const RUN_ENDINGS = [
  'completed',
  'failed',
  'stopped',
  'abandoned',
  'withdrawn',
  'superseded',
] as const;

export type RunEnding = (typeof RUN_ENDINGS)[number];

const OUTCOMES = ['completed', 'failed', 'abandoned', 'withdrawn'] as const;

type RunOutcome = (typeof OUTCOMES)[number];

const outcomeOf = (raw: string): RunOutcome | null =>
  OUTCOMES.find((each) => each === raw) ?? null;

export const endingOf = (input: {
  outcome: string;
  stopped: boolean;
  failure: string | null;
}): RunEnding | null => {
  const outcome = outcomeOf(input.outcome);

  if (!outcome) {
    return null;
  }
  if (input.failure === 'superseded') {
    return 'superseded';
  }
  if (input.stopped && outcome === 'completed') {
    return 'stopped';
  }

  return outcome;
};
