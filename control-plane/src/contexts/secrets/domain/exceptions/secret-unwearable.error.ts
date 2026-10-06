export class SecretUnwearableError extends Error {
  readonly violation = 'conflict' as const;

  constructor(secretName: string) {
    super(
      `Secret ${secretName} holds more than one line. It cannot be sent in a request header.`,
    );
    this.name = 'SecretUnwearableError';
  }
}
