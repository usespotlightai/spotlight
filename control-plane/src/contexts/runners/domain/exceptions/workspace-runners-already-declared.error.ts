export class WorkspaceRunnersAlreadyDeclaredError extends Error {
  readonly violation = 'conflict' as const;

  constructor(workspaceId: string) {
    super(`The workspace already declares its runners (${workspaceId})`);
    this.name = 'WorkspaceRunnersAlreadyDeclaredError';
  }
}
