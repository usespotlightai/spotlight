export class InboxRequestVersionConflictError extends Error {
  readonly kind = 'conflict' as const;

  constructor(id: string) {
    super(
      `Inbox request ${id} changed since you loaded it. Please reload and try again.`,
    );
    this.name = 'InboxRequestVersionConflictError';
  }
}
