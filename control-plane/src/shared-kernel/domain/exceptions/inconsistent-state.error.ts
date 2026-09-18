// No `violation` field, so this surfaces as a 5xx, not a 4xx.
export class InconsistentStateError extends Error {
  constructor(aggregate: string, reason: string) {
    super(`A stored ${aggregate} ${reason}`);
    this.name = 'InconsistentStateError';
  }
}
