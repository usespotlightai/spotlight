export class SecretNotBoundError extends Error {
  readonly kind = 'not-allowed' as const;

  constructor(secretName: string, host: string) {
    super(`Secret ${secretName} is not bound to ${host}.`);
    this.name = 'SecretNotBoundError';
  }
}
