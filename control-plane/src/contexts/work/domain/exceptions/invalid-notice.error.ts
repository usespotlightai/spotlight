export class InvalidNoticeError extends Error {
  readonly kind = 'invalid' as const;

  constructor(reason: string) {
    super(`Notice ${reason}.`);
    this.name = 'InvalidNoticeError';
  }
}
