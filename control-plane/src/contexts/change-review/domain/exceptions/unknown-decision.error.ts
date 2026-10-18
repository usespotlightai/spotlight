export class UnknownDecisionError extends Error {
  readonly kind = 'not-found' as const;

  constructor() {
    super('Decision not found.');
    this.name = 'UnknownDecisionError';
  }
}
