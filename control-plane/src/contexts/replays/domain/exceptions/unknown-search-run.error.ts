export class UnknownSearchRunError extends Error {
  readonly violation = 'not-found' as const;

  constructor(runId: string) {
    super(`No search ran ${runId}`);
    this.name = 'UnknownSearchRunError';
  }
}
