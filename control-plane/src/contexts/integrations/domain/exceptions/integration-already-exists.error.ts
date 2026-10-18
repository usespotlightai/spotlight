export class IntegrationAlreadyExistsError extends Error {
  readonly kind = 'conflict' as const;

  constructor(integration: string) {
    super(`Integration ${integration} already exists in this team.`);
    this.name = 'IntegrationAlreadyExistsError';
  }
}
