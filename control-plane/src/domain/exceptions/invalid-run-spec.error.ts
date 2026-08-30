export class InvalidRunSpecError extends Error {
  readonly violation = 'invalid' as const;

  constructor(reason: string) {
    super(`A run spec ${reason}`);
    this.name = 'InvalidRunSpecError';
  }
}
