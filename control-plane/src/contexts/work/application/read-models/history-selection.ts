import type { RunResultShape } from '@work/application/ports/run-results.port';

export const HISTORY_RUNS = { usual: 30, max: 50, matched: 500 } as const;

export const historyLength = (requested: number | null): number =>
  requested === null || !Number.isFinite(requested) || requested < 1
    ? HISTORY_RUNS.usual
    : Math.min(Math.floor(requested), HISTORY_RUNS.max);

export const turnedOut = (
  outcome: RunResultShape | null,
  wanted: string,
): boolean =>
  outcome !== null &&
  [
    outcome.ending,
    outcome.failure,
    outcome.humanAction?.kind ?? null,
    outcome.pullRequestState,
    outcome.peopleVerdict?.from ?? null,
    outcome.checks === null ? null : `checks-${outcome.checks}`,
  ].includes(wanted);
