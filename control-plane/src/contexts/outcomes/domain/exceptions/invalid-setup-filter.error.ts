export class InvalidSetupFilterError extends Error {
  readonly violation = 'invalid' as const;

  constructor(reason: string) {
    super(`Setup filter ${reason}.`);
    this.name = 'InvalidSetupFilterError';
  }
}
