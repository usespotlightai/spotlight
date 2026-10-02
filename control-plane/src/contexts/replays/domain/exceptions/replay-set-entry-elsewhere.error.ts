export class ReplaySetEntryElsewhereError extends Error {
  readonly violation = 'invalid' as const;

  constructor(runId: string) {
    super(`The run ${runId} worked at another station than the replay set’s`);
    this.name = 'ReplaySetEntryElsewhereError';
  }
}
