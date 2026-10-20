import type { RunJournal } from '@work/application/contracts/run-journal.contract';

export const lastWordsIn = (
  attempts: readonly RunJournal[],
  since: Date | null,
): string | null => {
  const latest = attempts.reduce<RunJournal | null>(
    (found, each) => (!found || each.attempt > found.attempt ? each : found),
    null,
  );

  return (
    [...(latest?.steps ?? [])]
      .reverse()
      .find(
        (step) => step.kind === 'message' && (!since || step.startedAt > since),
      )?.text ?? null
  );
};
