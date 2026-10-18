export class NoSuchWorkspaceError extends Error {
  readonly kind = 'not-found' as const;

  constructor(workspaceId: string) {
    super(`Workspace ${workspaceId} not found.`);
    this.name = 'NoSuchWorkspaceError';
  }
}
