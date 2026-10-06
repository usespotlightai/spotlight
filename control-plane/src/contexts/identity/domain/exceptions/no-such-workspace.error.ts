export class NoSuchWorkspaceError extends Error {
  readonly violation = 'not-found' as const;

  constructor(workspaceId: string) {
    super(`Workspace ${workspaceId} not found.`);
    this.name = 'NoSuchWorkspaceError';
  }
}
