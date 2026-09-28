export class InvalidWorkspaceArchiveTransitionError extends Error {
  readonly violation = 'conflict' as const;

  constructor(reason: string) {
    super(`A workspace archive ${reason}`);
    this.name = 'InvalidWorkspaceArchiveTransitionError';
  }
}
