export class InvalidRemarkError extends Error {
  readonly violation = 'invalid' as const;

  constructor(reason: string) {
    super(`Remark ${reason}.`);
    this.name = 'InvalidRemarkError';
  }
}
