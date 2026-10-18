export class UnknownSearchRunError extends Error {
  readonly kind = 'not-found' as const;

  constructor(runId: string) {
    super(`No search ran ${runId}`);
    this.name = 'UnknownSearchRunError';
  }
}
