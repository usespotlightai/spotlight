export class SecretNotBoundError extends Error {
  readonly violation = 'not-allowed' as const;

  constructor(secretName: string, toward: string) {
    super(
      `The ${secretName} secret is not bound to ${toward}, so it is never sent there`,
    );
    this.name = 'SecretNotBoundError';
  }
}
