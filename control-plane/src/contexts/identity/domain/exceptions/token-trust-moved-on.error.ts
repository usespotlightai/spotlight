export class TokenTrustMovedOnError extends Error {
  readonly violation = 'conflict' as const;

  constructor(trustId: string) {
    super(
      `This token trust has been changed since it was read, and cannot be written over (${trustId})`,
    );
    this.name = 'TokenTrustMovedOnError';
  }
}
