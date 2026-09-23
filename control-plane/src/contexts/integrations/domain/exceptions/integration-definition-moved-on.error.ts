export class IntegrationDefinitionMovedOnError extends Error {
  readonly violation = 'conflict' as const;

  constructor(source: string) {
    super(`The ${source} integration was defined again while this was`);
    this.name = 'IntegrationDefinitionMovedOnError';
  }
}
