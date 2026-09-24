export class SecretUnwearableError extends Error {
  readonly violation = 'conflict' as const;

  constructor(secretName: string) {
    super(
      `The ${secretName} secret holds more than one line, so it cannot be worn in a request header`,
    );
    this.name = 'SecretUnwearableError';
  }
}
