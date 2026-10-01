export class InvalidSetupFilterError extends Error {
  readonly violation = 'invalid' as const;

  constructor(reason: string) {
    super(`Setups are compared ${reason}`);
    this.name = 'InvalidSetupFilterError';
  }
}
