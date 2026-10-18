export class WorkspaceRunnersAlreadyExistError extends Error {
  readonly kind = 'conflict' as const;

  constructor(workspaceId: string) {
    super(`Workspace ${workspaceId} already has its workspace runners.`);
    this.name = 'WorkspaceRunnersAlreadyExistError';
  }
}
