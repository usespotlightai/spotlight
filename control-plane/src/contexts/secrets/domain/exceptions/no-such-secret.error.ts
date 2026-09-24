export class NoSuchSecretError extends Error {
  readonly violation = 'conflict' as const;

  constructor(secretName: string) {
    super(
      `The workspace holds no secret named ${secretName}; define it before anything uses it`,
    );
    this.name = 'NoSuchSecretError';
  }
}
