export class SecretMovedOnError extends Error {
  readonly violation = 'conflict' as const;

  constructor(name: string) {
    super(
      `The ${name} secret has been changed since it was read, and cannot be written over`,
    );
    this.name = 'SecretMovedOnError';
  }
}
