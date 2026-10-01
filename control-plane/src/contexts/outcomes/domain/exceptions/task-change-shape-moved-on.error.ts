export class TaskChangeShapeMovedOnError extends Error {
  readonly violation = 'conflict' as const;

  constructor(taskId: string) {
    super(
      `This task's change shape changed since it was read, and cannot be written over (${taskId})`,
    );
    this.name = 'TaskChangeShapeMovedOnError';
  }
}
