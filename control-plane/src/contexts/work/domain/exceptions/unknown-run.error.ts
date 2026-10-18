export class UnknownRunError extends Error {
  readonly kind = 'not-found' as const;

  constructor(reason: string) {
    super(reason);
    this.name = 'UnknownRunError';
  }
}
