export class InvalidRunnerImageError extends Error {
  readonly violation = 'invalid' as const;

  constructor(readonly because: string) {
    super(`A runner image ${because}`);
    this.name = 'InvalidRunnerImageError';
  }
}
