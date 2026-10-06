export class WorkspaceArchiveNotUploadedError extends Error {
  readonly violation = 'conflict' as const;

  constructor(id: string, reason: string) {
    super(`Workspace archive ${id} ${reason}.`);
    this.name = 'WorkspaceArchiveNotUploadedError';
  }
}
