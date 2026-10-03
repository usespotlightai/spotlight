export class NoticeMovedOnError extends Error {
  readonly violation = 'conflict' as const;

  constructor(id: string) {
    super(
      `This notice changed since it was read, and cannot be written over (${id})`,
    );
    this.name = 'NoticeMovedOnError';
  }
}
