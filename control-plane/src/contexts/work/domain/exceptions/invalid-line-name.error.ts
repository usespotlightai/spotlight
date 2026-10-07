export class InvalidLineNameError extends Error {
  readonly violation = 'invalid' as const;

  constructor(reason: string) {
    super(`Line name ${reason}.`);
    this.name = 'InvalidLineNameError';
  }
}
