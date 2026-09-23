export class NoSuchWorkspaceError extends Error {
  readonly violation = 'not-found' as const;

  constructor(workspaceId: string) {
    super(`There is no workspace ${workspaceId} any more`);
    this.name = 'NoSuchWorkspaceError';
  }
}
