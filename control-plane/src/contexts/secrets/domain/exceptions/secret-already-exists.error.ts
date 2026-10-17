export class SecretAlreadyExistsError extends Error {
  readonly violation = 'conflict' as const;

  constructor(readonly secretName: string) {
    super(
      `A secret named ${secretName} already exists. Please choose another name.`,
    );
    this.name = 'SecretAlreadyExistsError';
  }
}
