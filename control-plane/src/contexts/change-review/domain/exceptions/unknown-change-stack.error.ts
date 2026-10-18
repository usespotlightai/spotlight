export class UnknownChangeStackError extends Error {
  readonly kind = 'not-found' as const;

  constructor(reason: string) {
    super(reason);
    this.name = 'UnknownChangeStackError';
  }
}
