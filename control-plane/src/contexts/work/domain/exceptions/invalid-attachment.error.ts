export class InvalidAttachmentError extends Error {
  readonly violation = 'invalid' as const;

  constructor(reason: string) {
    super(`An attachment ${reason}`);
    this.name = 'InvalidAttachmentError';
  }
}
