export class WorkspaceArchiveMovedOnError extends Error {
  readonly violation = 'conflict' as const;

  constructor(id: string) {
    super(
      `Workspace archive ${id} changed since you loaded it. Please reload and try again.`,
    );
    this.name = 'WorkspaceArchiveMovedOnError';
  }
}
