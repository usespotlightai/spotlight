export class ReplaySetEntryElsewhereError extends Error {
  readonly kind = 'invalid' as const;

  constructor(runId: string) {
    super(`Run ${runId} worked at a different station from the replay set.`);
    this.name = 'ReplaySetEntryElsewhereError';
  }
}
