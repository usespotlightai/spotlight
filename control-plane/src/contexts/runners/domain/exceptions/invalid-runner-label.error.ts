export class InvalidRunnerLabelError extends Error {
  readonly violation = 'invalid' as const;

  constructor(readonly because: string) {
    super(`Runner label ${because}.`);
    this.name = 'InvalidRunnerLabelError';
  }
}
