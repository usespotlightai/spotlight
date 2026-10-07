export class WorkspaceRunnersMovedOnError extends Error {
  readonly violation = 'conflict' as const;

  constructor(id: string) {
    super(
      `Workspace runners ${id} changed since you loaded them. Please reload and try again.`,
    );
    this.name = 'WorkspaceRunnersMovedOnError';
  }
}
