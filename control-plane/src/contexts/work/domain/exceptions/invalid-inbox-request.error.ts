export class InvalidInboxRequestError extends Error {
  readonly kind = 'invalid' as const;

  constructor(reason: string) {
    super(`Inbox request ${reason}.`);
    this.name = 'InvalidInboxRequestError';
  }
}
