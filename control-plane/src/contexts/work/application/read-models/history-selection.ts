import type { RunOutcomeShape } from '@work/application/ports/run-outcomes.port';

export const HISTORY_RUNS = { usual: 30, most: 50, searched: 500 } as const;

export const historyLength = (asked: number | null): number =>
  asked === null || !Number.isFinite(asked) || asked < 1
    ? HISTORY_RUNS.usual
    : Math.min(Math.floor(asked), HISTORY_RUNS.most);

export const turnedOut = (
  outcome: RunOutcomeShape | null,
  wanted: string,
): boolean =>
  outcome !== null &&
  [
    outcome.ending,
    outcome.failure,
    outcome.next?.act ?? null,
    outcome.delivery,
    outcome.checks === null ? null : `checks-${outcome.checks}`,
  ].includes(wanted);
