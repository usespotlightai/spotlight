export class InvalidNoticeExternalLinkError extends Error {
  readonly kind = 'invalid' as const;

  constructor(reason: string) {
    super(`Notice external link ${reason}.`);
    this.name = 'InvalidNoticeExternalLinkError';
  }
}
