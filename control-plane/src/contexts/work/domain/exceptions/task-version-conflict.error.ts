export class TaskVersionConflictError extends Error {
  readonly violation = 'conflict' as const;

  constructor(id: string) {
    super(
      `Task ${id} changed since you loaded it. Please reload and try again.`,
    );
    this.name = 'TaskVersionConflictError';
  }
}
