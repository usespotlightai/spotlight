export class TokenTrustMovedOnError extends Error {
  readonly violation = 'conflict' as const;

  constructor(trustId: string) {
    super(
      `Token trust ${trustId} changed since you loaded it. Please reload and try again.`,
    );
    this.name = 'TokenTrustMovedOnError';
  }
}
