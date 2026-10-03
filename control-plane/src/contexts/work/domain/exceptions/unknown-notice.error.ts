export class UnknownNoticeError extends Error {
  readonly violation = 'not-found' as const;

  constructor(id: string) {
    super(`There is no notice ${id} for this caller`);
    this.name = 'UnknownNoticeError';
  }
}
