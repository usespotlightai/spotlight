export class InvalidRemarkError extends Error {
  readonly violation = 'invalid' as const;

  constructor(reason: string) {
    super(`A remark ${reason}`);
    this.name = 'InvalidRemarkError';
  }
}
