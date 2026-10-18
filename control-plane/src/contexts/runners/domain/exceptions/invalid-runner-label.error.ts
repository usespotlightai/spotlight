export class InvalidRunnerLabelError extends Error {
  readonly kind = 'invalid' as const;

  constructor(readonly because: string) {
    super(`Runner label ${because}.`);
    this.name = 'InvalidRunnerLabelError';
  }
}
