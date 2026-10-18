export class UnknownNoticeError extends Error {
  readonly kind = 'not-found' as const;

  constructor(id: string) {
    super(`Notice ${id} not found.`);
    this.name = 'UnknownNoticeError';
  }
}
