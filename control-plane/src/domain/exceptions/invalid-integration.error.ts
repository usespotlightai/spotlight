/** The reason is the only thing whoever wrote the file can act on. */
export class InvalidIntegrationError extends Error {
  readonly violation = 'invalid' as const;

  constructor(source: string, reason: string) {
    super(`The ${source} integration ${reason}`);
    this.name = 'InvalidIntegrationError';
  }
}
