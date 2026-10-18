export class WorkspaceVersionConflictError extends Error {
  readonly kind = 'conflict' as const;

  constructor(slug: string) {
    super(
      `Workspace ${slug} changed since you loaded it. Please reload and try again.`,
    );
    this.name = 'WorkspaceVersionConflictError';
  }
}
