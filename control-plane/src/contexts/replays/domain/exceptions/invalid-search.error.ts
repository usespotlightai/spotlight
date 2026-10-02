export class InvalidSearchError extends Error {
  readonly violation = 'invalid' as const;

  constructor(readonly reason: string) {
    super(`A search ${reason}`);
    this.name = 'InvalidSearchError';
  }
}
