export class InvalidHarnessIdError extends Error {
  readonly kind = 'invalid' as const;

  constructor(reason: string) {
    super(`Harness id ${reason}.`);
    this.name = 'InvalidHarnessIdError';
  }
}
