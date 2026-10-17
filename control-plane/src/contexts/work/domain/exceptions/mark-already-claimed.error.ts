export class MarkAlreadyClaimedError extends Error {
  readonly violation = 'conflict' as const;

  constructor(mark: string) {
    super(`Mark ${mark} was just claimed by another task.`);
    this.name = 'MarkAlreadyClaimedError';
  }
}
