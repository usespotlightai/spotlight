export class InvalidRunnerNameError extends Error {
  readonly violation = 'invalid' as const;

  constructor(reason: string) {
    super(`A runner name ${reason}`);
    this.name = 'InvalidRunnerNameError';
  }
}
