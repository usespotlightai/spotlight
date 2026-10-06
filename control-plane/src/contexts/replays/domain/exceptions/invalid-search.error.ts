export class InvalidSearchError extends Error {
  readonly violation = 'invalid' as const;

  constructor(readonly reason: string) {
    super(`Search ${reason}.`);
    this.name = 'InvalidSearchError';
  }
}
