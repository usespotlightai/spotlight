export class WorkspaceArchiveMovedOnError extends Error {
  readonly violation = 'conflict' as const;

  constructor(id: string) {
    super(
      `This workspace archive has changed since it was read, and cannot be written over (${id})`,
    );
    this.name = 'WorkspaceArchiveMovedOnError';
  }
}
