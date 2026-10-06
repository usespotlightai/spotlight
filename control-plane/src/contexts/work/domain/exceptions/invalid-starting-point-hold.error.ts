export class InvalidStartingPointHoldError extends Error {
  readonly violation = 'invalid' as const;

  constructor(reason: string) {
    super(`Starting point hold ${reason}.`);
    this.name = 'InvalidStartingPointHoldError';
  }
}
