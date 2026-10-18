export class InvalidRunSpecError extends Error {
  readonly kind = 'invalid' as const;

  constructor(reason: string) {
    super(`Run spec ${reason}.`);
    this.name = 'InvalidRunSpecError';
  }
}
