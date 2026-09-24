export class InvalidRunnerPoolError extends Error {
  readonly violation = 'invalid' as const;

  constructor(
    readonly field: string,
    readonly because: string,
  ) {
    super(`A runner pool's ${field} ${because}`);
    this.name = 'InvalidRunnerPoolError';
  }
}
