export class ReplaySetEntryTakenError extends Error {
  readonly violation = 'conflict' as const;

  constructor(runId: string) {
    super(`The run ${runId} is already in the replay set`);
    this.name = 'ReplaySetEntryTakenError';
  }
}
