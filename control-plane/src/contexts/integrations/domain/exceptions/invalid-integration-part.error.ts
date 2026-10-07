export class InvalidIntegrationPartError extends Error {
  readonly violation = 'invalid' as const;

  constructor(
    part: string,
    readonly because: string,
  ) {
    super(`Integration ${part} ${because}.`);
    this.name = 'InvalidIntegrationPartError';
  }
}
