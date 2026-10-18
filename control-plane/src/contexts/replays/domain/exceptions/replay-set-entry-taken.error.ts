export class ReplaySetEntryTakenError extends Error {
  readonly kind = 'conflict' as const;

  constructor(runId: string) {
    super(`Run ${runId} is already in the replay set.`);
    this.name = 'ReplaySetEntryTakenError';
  }
}
