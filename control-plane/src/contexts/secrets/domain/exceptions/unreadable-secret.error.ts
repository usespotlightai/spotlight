export class UnreadableSecretError extends Error {
  readonly violation = 'refused' as const;

  constructor(secretName: string, because: string) {
    super(`Secret ${secretName} could not be read. ${because}`);
    this.name = 'UnreadableSecretError';
  }
}
