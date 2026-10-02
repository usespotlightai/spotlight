export class InvalidStartingPointError extends Error {
  readonly violation = 'invalid' as const;

  constructor(reason: string) {
    super(`Where a run started ${reason}`);
    this.name = 'InvalidStartingPointError';
  }
}
