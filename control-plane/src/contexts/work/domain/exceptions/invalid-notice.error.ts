export class InvalidNoticeError extends Error {
  readonly violation = 'invalid' as const;

  constructor(reason: string) {
    super(`Notice ${reason}.`);
    this.name = 'InvalidNoticeError';
  }
}
