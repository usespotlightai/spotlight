export class WorkspaceRunnersVersionConflictError extends Error {
  readonly kind = 'conflict' as const;

  constructor(id: string) {
    super(
      `Workspace runners ${id} changed since you loaded them. Please reload and try again.`,
    );
    this.name = 'WorkspaceRunnersVersionConflictError';
  }
}
