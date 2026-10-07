export class WorkspaceMovedOnError extends Error {
  readonly violation = 'conflict' as const;

  constructor(slug: string) {
    super(
      `Workspace ${slug} changed since you loaded it. Please reload and try again.`,
    );
    this.name = 'WorkspaceMovedOnError';
  }
}
