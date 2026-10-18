export class InvalidWorkspaceArchiveError extends Error {
  readonly kind = 'invalid' as const;

  constructor(reason: string) {
    super(`Workspace archive ${reason}.`);
    this.name = 'InvalidWorkspaceArchiveError';
  }
}
