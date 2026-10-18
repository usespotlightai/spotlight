export class InvalidRunnerPlacementError extends Error {
  readonly kind = 'invalid' as const;

  constructor(readonly because: string) {
    super(`Runners ${because}.`);
    this.name = 'InvalidRunnerPlacementError';
  }
}
