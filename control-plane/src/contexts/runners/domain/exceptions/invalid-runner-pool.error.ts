export class InvalidRunnerPoolError extends Error {
  readonly violation = 'invalid' as const;

  constructor(
    readonly field: string,
    readonly because: string,
  ) {
    super(`Runner pool ${field} ${because}.`);
    this.name = 'InvalidRunnerPoolError';
  }
}
