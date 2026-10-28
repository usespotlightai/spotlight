export class ReplaySetEntryTakenError extends Error {
  readonly kind = 'conflict' as const;

  constructor(runId: string) {
    super(`Run ${runId} or its task is in the replay set already.`);
    this.name = 'ReplaySetEntryTakenError';
  }
}
