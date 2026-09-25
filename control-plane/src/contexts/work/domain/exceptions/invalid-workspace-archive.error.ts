export class InvalidWorkspaceArchiveError extends Error {
  readonly violation = 'invalid' as const;

  constructor(reason: string) {
    super(`A workspace archive ${reason}`);
    this.name = 'InvalidWorkspaceArchiveError';
  }
}
