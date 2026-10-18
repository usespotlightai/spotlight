export class InvalidAttachmentError extends Error {
  readonly kind = 'invalid' as const;

  constructor(reason: string) {
    super(`Attachment ${reason}.`);
    this.name = 'InvalidAttachmentError';
  }
}
