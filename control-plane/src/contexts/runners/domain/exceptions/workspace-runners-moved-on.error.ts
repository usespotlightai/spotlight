export class WorkspaceRunnersMovedOnError extends Error {
  readonly violation = 'conflict' as const;

  constructor(id: string) {
    super(
      `The workspace's runners have been declared again since they were read, and cannot be written over (${id})`,
    );
    this.name = 'WorkspaceRunnersMovedOnError';
  }
}
