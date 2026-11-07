interface AttemptsOfRun {
  readonly attempt: number;
  readonly suspendedAttempts: readonly number[];
}

export const isJournalledAttempt = (
  attempt: number,
  run: AttemptsOfRun,
): boolean =>
  attempt === run.attempt || run.suspendedAttempts.includes(attempt);
