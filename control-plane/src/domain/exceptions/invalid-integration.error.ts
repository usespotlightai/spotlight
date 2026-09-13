export class InvalidIntegrationError extends Error {
  readonly violation = 'invalid' as const;

  constructor(source: string, reason: string) {
    super(`The ${source} integration ${reason}`);
    this.name = 'InvalidIntegrationError';
  }
}
