export class NoticeVersionConflictError extends Error {
  readonly kind = 'conflict' as const;

  constructor(id: string) {
    super(
      `Notice ${id} changed since you loaded it. Please reload and try again.`,
    );
    this.name = 'NoticeVersionConflictError';
  }
}
