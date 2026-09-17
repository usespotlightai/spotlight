export class PendingLineUnreadableError extends Error {
  readonly violation = 'conflict' as const;

  constructor(line: string, because: string) {
    super(
      `The ${line} line on the open configuration pull request does not read (${because}): fix it on the pull request first`,
    );
    this.name = 'PendingLineUnreadableError';
  }
}
