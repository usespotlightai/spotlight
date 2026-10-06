export class WorkspaceRunnersAlreadyDeclaredError extends Error {
  readonly violation = 'conflict' as const;

  constructor(workspaceId: string) {
    super(`Workspace ${workspaceId} already declares its runners.`);
    this.name = 'WorkspaceRunnersAlreadyDeclaredError';
  }
}
