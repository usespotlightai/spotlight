export class TaskChangeShapeMovedOnError extends Error {
  readonly violation = 'conflict' as const;

  constructor(taskId: string) {
    super(
      `Change shape of task ${taskId} changed since you loaded it. Please reload and try again.`,
    );
    this.name = 'TaskChangeShapeMovedOnError';
  }
}
