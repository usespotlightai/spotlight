export class UnknownDecisionError extends Error {
  readonly violation = 'not-found' as const;

  constructor() {
    super('Decision not found.');
    this.name = 'UnknownDecisionError';
  }
}
