export class WorkspaceMovedOnError extends Error {
  readonly violation = 'conflict' as const;

  constructor(slug: string) {
    super(
      `This workspace has been changed since it was read, and cannot be written over (${slug})`,
    );
    this.name = 'WorkspaceMovedOnError';
  }
}
