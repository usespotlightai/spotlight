export class IntegrationDefinitionVersionConflictError extends Error {
  readonly violation = 'conflict' as const;

  constructor(integration: string) {
    super(`Integration ${integration} changed while saving. Please try again.`);
    this.name = 'IntegrationDefinitionVersionConflictError';
  }
}
