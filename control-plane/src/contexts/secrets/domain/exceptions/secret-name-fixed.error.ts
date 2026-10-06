export class SecretNameFixedError extends Error {
  readonly violation = 'invalid' as const;

  readonly field = 'name';

  constructor(
    readonly secretName: string,
    readonly because: string,
  ) {
    super(`Secret ${secretName} ${because}.`);
    this.name = 'SecretNameFixedError';
  }
}
