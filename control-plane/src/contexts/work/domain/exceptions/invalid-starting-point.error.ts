export class InvalidStartingPointError extends Error {
  readonly kind = 'invalid' as const;

  constructor(reason: string) {
    super(`Starting point ${reason}.`);
    this.name = 'InvalidStartingPointError';
  }
}
