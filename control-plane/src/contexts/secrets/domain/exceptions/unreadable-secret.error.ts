export class UnreadableSecretError extends Error {
  readonly kind = 'upstream-error' as const;

  constructor(secretName: string, because: string) {
    super(`Secret ${secretName} could not be read. ${because}`);
    this.name = 'UnreadableSecretError';
  }
}
