export class RefreshClaimedError extends Error {
  readonly kind = 'conflict' as const;

  constructor(integration: string) {
    super(
      `The ${integration} connection is already being refreshed. Please try again later.`,
    );
    this.name = 'RefreshClaimedError';
  }
}
