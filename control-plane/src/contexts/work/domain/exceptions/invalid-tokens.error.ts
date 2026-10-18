export class InvalidTokensError extends Error {
  readonly kind = 'invalid' as const;

  constructor(count: number) {
    super(`Token count must be a whole number from 0. Value: ${count}`);
    this.name = 'InvalidTokensError';
  }
}
