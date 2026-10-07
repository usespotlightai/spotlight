export class IntegrationAlreadyDefinedError extends Error {
  readonly violation = 'conflict' as const;

  constructor(source: string) {
    super(`Integration ${source} already exists in this team.`);
    this.name = 'IntegrationAlreadyDefinedError';
  }
}
