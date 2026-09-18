export class UnknownRunError extends Error {
  readonly violation = 'not-found' as const;

  constructor(reason: string) {
    super(reason);
    this.name = 'UnknownRunError';
  }
}
