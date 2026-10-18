export class WorkspaceArchiveVersionConflictError extends Error {
  readonly kind = 'conflict' as const;

  constructor(id: string) {
    super(
      `Workspace archive ${id} changed since you loaded it. Please reload and try again.`,
    );
    this.name = 'WorkspaceArchiveVersionConflictError';
  }
}
