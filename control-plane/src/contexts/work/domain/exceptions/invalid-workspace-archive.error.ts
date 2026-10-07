export class InvalidWorkspaceArchiveError extends Error {
  readonly violation = 'invalid' as const;

  constructor(reason: string) {
    super(`Workspace archive ${reason}.`);
    this.name = 'InvalidWorkspaceArchiveError';
  }
}
