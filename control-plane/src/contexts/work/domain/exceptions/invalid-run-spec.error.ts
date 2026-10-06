export class InvalidRunSpecError extends Error {
  readonly violation = 'invalid' as const;

  constructor(reason: string) {
    super(`Run spec ${reason}.`);
    this.name = 'InvalidRunSpecError';
  }
}
