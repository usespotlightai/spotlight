export class InvalidTokenTrustError extends Error {
  readonly violation = 'invalid' as const;

  constructor(
    readonly field: string,
    readonly because: string,
  ) {
    super(`A workspace token trust's ${field} ${because}`);
    this.name = 'InvalidTokenTrustError';
  }
}
