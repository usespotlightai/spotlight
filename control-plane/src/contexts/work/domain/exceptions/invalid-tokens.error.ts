export class InvalidTokensError extends Error {
  readonly violation = 'invalid' as const;

  constructor(count: number) {
    super(`A token count must be a whole number of at least 0, not ${count}`);
    this.name = 'InvalidTokensError';
  }
}
