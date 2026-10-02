export class InvalidSpendError extends Error {
  readonly violation = 'invalid' as const;

  constructor(reason: string) {
    super(`What a replay spends ${reason}`);
    this.name = 'InvalidSpendError';
  }
}
