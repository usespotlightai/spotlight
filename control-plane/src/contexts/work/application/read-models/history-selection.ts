import type { RunOutcomeShape } from '@work/application/ports/run-outcomes.port';

export const HISTORY_RUNS = { usual: 30, max: 50, matched: 500 } as const;

export const historyLength = (requested: number | null): number =>
  requested === null || !Number.isFinite(requested) || requested < 1
    ? HISTORY_RUNS.usual
    : Math.min(Math.floor(requested), HISTORY_RUNS.max);

export const turnedOut = (
  outcome: RunOutcomeShape | null,
  wanted: string,
): boolean =>
  outcome !== null &&
  [
    outcome.ending,
    outcome.failure,
    outcome.firstHumanAction?.kind ?? null,
    outcome.pullRequestState,
    outcome.checks === null ? null : `checks-${outcome.checks}`,
  ].includes(wanted);
