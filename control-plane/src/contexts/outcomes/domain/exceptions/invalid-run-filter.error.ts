export class InvalidRunFilterError extends Error {
  readonly violation = 'invalid' as const;

  constructor(reason: string) {
    super(`Run filter ${reason}.`);
    this.name = 'InvalidRunFilterError';
  }
}
