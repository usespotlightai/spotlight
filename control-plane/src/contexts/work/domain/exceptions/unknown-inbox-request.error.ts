export class UnknownInboxRequestError extends Error {
  readonly kind = 'not-found' as const;

  constructor(id: string) {
    super(`Inbox request ${id} not found.`);
    this.name = 'UnknownInboxRequestError';
  }
}
