export class InvalidIntegrationError extends Error {
  readonly violation = 'invalid' as const;

  constructor(
    integration: string,
    readonly because: string,
  ) {
    super(`Integration ${integration} ${because}.`);
    this.name = 'InvalidIntegrationError';
  }
}
