export class RunLeaseOverError extends Error {
  readonly violation = 'not-allowed' as const;

  constructor(runId: string, attempt: number) {
    super(
      `The lease of run ${runId} for attempt ${attempt} is over. That attempt can receive no more secrets.`,
    );
    this.name = 'RunLeaseOverError';
  }
}
