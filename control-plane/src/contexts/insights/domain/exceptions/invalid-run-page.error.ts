export class InvalidRunPageError extends Error {
  readonly violation = 'invalid' as const;

  constructor(reason: string) {
    super(`Run page ${reason}.`);
    this.name = 'InvalidRunPageError';
  }
}
