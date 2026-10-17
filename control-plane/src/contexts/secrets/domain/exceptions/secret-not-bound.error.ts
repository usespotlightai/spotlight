export class SecretNotBoundError extends Error {
  readonly violation = 'not-allowed' as const;

  constructor(secretName: string, host: string) {
    super(`Secret ${secretName} is not bound to ${host}.`);
    this.name = 'SecretNotBoundError';
  }
}
