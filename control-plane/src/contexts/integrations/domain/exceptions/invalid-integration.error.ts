export class InvalidIntegrationError extends Error {
  readonly violation = 'invalid' as const;

  constructor(
    source: string,
    readonly because: string,
  ) {
    super(`The ${source} integration ${because}`);
    this.name = 'InvalidIntegrationError';
  }
}
