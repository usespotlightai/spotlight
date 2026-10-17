export class NoSuchSecretError extends Error {
  readonly violation = 'conflict' as const;

  constructor(secretName: string) {
    super(`Secret ${secretName} not found. Please create it first.`);
    this.name = 'NoSuchSecretError';
  }
}
