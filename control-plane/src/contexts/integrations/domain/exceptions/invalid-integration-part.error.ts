export class InvalidIntegrationPartError extends Error {
  readonly kind = 'invalid' as const;

  constructor(
    part: string,
    readonly because: string,
  ) {
    super(`Integration ${part} ${because}.`);
    this.name = 'InvalidIntegrationPartError';
  }
}
