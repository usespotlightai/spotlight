export class NoSuchSecretError extends Error {
  readonly kind = 'conflict' as const;

  constructor(secretName: string) {
    super(`Secret ${secretName} not found. Please create it first.`);
    this.name = 'NoSuchSecretError';
  }
}
