export class InvalidStartingPointHoldError extends Error {
  readonly violation = 'invalid' as const;

  constructor(reason: string) {
    super(`A hold on where runs started ${reason}`);
    this.name = 'InvalidStartingPointHoldError';
  }
}
