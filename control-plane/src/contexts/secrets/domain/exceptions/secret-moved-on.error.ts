export class SecretMovedOnError extends Error {
  readonly violation = 'conflict' as const;

  constructor(name: string) {
    super(
      `Secret ${name} changed since you loaded it. Please reload and try again.`,
    );
    this.name = 'SecretMovedOnError';
  }
}
