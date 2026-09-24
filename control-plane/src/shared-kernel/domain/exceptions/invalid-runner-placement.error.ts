export class InvalidRunnerPlacementError extends Error {
  readonly violation = 'invalid' as const;

  constructor(readonly because: string) {
    super(`Runners ${because}`);
    this.name = 'InvalidRunnerPlacementError';
  }
}
