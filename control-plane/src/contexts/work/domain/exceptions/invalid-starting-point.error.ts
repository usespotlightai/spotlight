export class InvalidStartingPointError extends Error {
  readonly violation = 'invalid' as const;

  constructor(reason: string) {
    super(`Starting point ${reason}.`);
    this.name = 'InvalidStartingPointError';
  }
}
