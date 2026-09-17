export class InvalidLineNameError extends Error {
  readonly violation = 'invalid' as const;

  constructor(reason: string) {
    super(`A line name ${reason}`);
    this.name = 'InvalidLineNameError';
  }
}
