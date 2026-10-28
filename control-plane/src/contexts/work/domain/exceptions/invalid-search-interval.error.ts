export class InvalidSearchIntervalError extends Error {
  readonly kind = 'invalid' as const;

  constructor(readonly because: string) {
    super(`Search interval ${because}.`);
    this.name = 'InvalidSearchIntervalError';
  }
}
