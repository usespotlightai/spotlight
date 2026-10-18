export class InvalidRunnerImageError extends Error {
  readonly kind = 'invalid' as const;

  constructor(readonly because: string) {
    super(`Runner image ${because}.`);
    this.name = 'InvalidRunnerImageError';
  }
}
