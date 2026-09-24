export class SecretAlreadyDefinedError extends Error {
  readonly violation = 'conflict' as const;

  constructor(readonly secretName: string) {
    super(`The workspace already holds a secret named ${secretName}`);
    this.name = 'SecretAlreadyDefinedError';
  }
}
