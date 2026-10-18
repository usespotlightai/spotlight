export class SearchIterationClosedError extends Error {
  readonly kind = 'not-found' as const;

  constructor(runId: string) {
    super(
      `The run ${runId} is no longer the active run of the search, so the search takes no more candidates from it`,
    );
    this.name = 'SearchIterationClosedError';
  }
}
