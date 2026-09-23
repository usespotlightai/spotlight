export class IntegrationAlreadyDefinedError extends Error {
  readonly violation = 'conflict' as const;

  constructor(source: string) {
    super(`The team already has a ${source} integration`);
    this.name = 'IntegrationAlreadyDefinedError';
  }
}
