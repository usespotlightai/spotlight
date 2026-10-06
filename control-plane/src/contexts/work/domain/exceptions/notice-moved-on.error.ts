export class NoticeMovedOnError extends Error {
  readonly violation = 'conflict' as const;

  constructor(id: string) {
    super(
      `Notice ${id} changed since you loaded it. Please reload and try again.`,
    );
    this.name = 'NoticeMovedOnError';
  }
}
