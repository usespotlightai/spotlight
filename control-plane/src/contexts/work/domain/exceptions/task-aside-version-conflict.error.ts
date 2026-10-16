export class TaskAsideVersionConflictError extends Error {
  readonly violation = 'conflict' as const;

  constructor(id: string) {
    super(
      `Task aside ${id} changed since you loaded it. Please reload and try again.`,
    );
    this.name = 'TaskAsideVersionConflictError';
  }
}
