export class UnreadableSecretError extends Error {
  readonly violation = 'refused' as const;

  constructor(secretName: string, because: string) {
    super(`The ${secretName} secret could not be read: ${because}`);
    this.name = 'UnreadableSecretError';
  }
}
