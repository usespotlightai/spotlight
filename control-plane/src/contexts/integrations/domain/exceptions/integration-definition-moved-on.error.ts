export class IntegrationDefinitionMovedOnError extends Error {
  readonly violation = 'conflict' as const;

  constructor(source: string) {
    super(`Integration ${source} changed while saving. Please try again.`);
    this.name = 'IntegrationDefinitionMovedOnError';
  }
}
