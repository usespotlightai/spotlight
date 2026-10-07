export class InvalidWorkspaceArchiveTransitionError extends Error {
  readonly violation = 'conflict' as const;

  constructor(reason: string) {
    super(`Workspace archive ${reason}.`);
    this.name = 'InvalidWorkspaceArchiveTransitionError';
  }
}
