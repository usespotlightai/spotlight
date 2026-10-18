export class SecretNotInjectableError extends Error {
  readonly kind = 'conflict' as const;

  constructor(secretName: string) {
    super(
      `Secret ${secretName} contains more than one line. It cannot be sent in a request.`,
    );
    this.name = 'SecretNotInjectableError';
  }
}
