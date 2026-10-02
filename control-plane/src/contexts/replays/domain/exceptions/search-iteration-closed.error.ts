export class SearchIterationClosedError extends Error {
  readonly violation = 'not-found' as const;

  constructor(runId: string) {
    super(
      `The search no longer holds the run ${runId}, so it takes no more candidates from it`,
    );
    this.name = 'SearchIterationClosedError';
  }
}
