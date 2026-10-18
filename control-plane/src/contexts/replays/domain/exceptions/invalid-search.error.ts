export class InvalidSearchError extends Error {
  readonly kind = 'invalid' as const;

  constructor(readonly reason: string) {
    super(`Search ${reason}.`);
    this.name = 'InvalidSearchError';
  }
}
