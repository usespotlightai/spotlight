export class TokenTrustVersionConflictError extends Error {
  readonly kind = 'conflict' as const;

  constructor(trustId: string) {
    super(
      `Token trust ${trustId} changed since you loaded it. Please reload and try again.`,
    );
    this.name = 'TokenTrustVersionConflictError';
  }
}
