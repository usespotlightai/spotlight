export class UnknownDecisionError extends Error {
  readonly violation = 'not-found' as const;

  constructor() {
    super('There is no such decision');
    this.name = 'UnknownDecisionError';
  }
}
