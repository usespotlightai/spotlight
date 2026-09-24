export class SecretNameFixedError extends Error {
  readonly violation = 'invalid' as const;

  readonly field = 'name';

  constructor(
    readonly secretName: string,
    readonly because: string,
  ) {
    super(`The ${secretName} secret ${because}`);
    this.name = 'SecretNameFixedError';
  }
}
