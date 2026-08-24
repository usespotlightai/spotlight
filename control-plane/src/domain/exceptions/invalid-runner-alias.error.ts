export class InvalidRunnerAliasError extends Error {
  readonly violation = 'invalid' as const;

  constructor(reason: string) {
    super(`A runner alias ${reason}`);
    this.name = 'InvalidRunnerAliasError';
  }
}
