export class InvalidTokenTrustError extends Error {
  readonly violation = 'invalid' as const;

  constructor(
    readonly field: string,
    readonly because: string,
  ) {
    super(`Token trust ${field} ${because}.`);
    this.name = 'InvalidTokenTrustError';
  }
}
