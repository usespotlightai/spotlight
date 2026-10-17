export class IntegrationConnectionVersionConflictError extends Error {
  readonly violation = 'conflict' as const;

  constructor(integration: string) {
    super(
      `Connection ${integration} changed while it was being refreshed. Please try again.`,
    );
    this.name = 'IntegrationConnectionVersionConflictError';
  }
}
