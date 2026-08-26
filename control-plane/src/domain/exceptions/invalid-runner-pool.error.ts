export class InvalidRunnerPoolError extends Error {
  readonly violation = 'invalid' as const;

  constructor(reason: string) {
    super(`A runner pool ${reason}`);
    this.name = 'InvalidRunnerPoolError';
  }
}
