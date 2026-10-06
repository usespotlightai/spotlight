export class SecretNotBoundError extends Error {
  readonly violation = 'not-allowed' as const;

  constructor(secretName: string, toward: string) {
    super(`Secret ${secretName} is not bound to ${toward}.`);
    this.name = 'SecretNotBoundError';
  }
}
