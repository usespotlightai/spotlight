export class InvalidAttachmentError extends Error {
  readonly violation = 'invalid' as const;

  constructor(reason: string) {
    super(`Attachment ${reason}.`);
    this.name = 'InvalidAttachmentError';
  }
}
