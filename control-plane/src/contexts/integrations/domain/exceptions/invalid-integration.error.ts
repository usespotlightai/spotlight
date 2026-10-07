export class InvalidIntegrationError extends Error {
  readonly violation = 'invalid' as const;

  constructor(
    source: string,
    readonly because: string,
  ) {
    super(`Integration ${source} ${because}.`);
    this.name = 'InvalidIntegrationError';
  }
}
