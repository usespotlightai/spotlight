export class UnknownNoticeError extends Error {
  readonly violation = 'not-found' as const;

  constructor(id: string) {
    super(`Notice ${id} not found.`);
    this.name = 'UnknownNoticeError';
  }
}
