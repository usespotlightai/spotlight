export class InvalidNoticeError extends Error {
  readonly violation = 'invalid' as const;

  constructor(reason: string) {
    super(`A notice ${reason}`);
    this.name = 'InvalidNoticeError';
  }
}
