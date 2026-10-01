export class TaskFailuresMovedOnError extends Error {
  readonly violation = 'conflict' as const;

  constructor(taskId: string) {
    super(
      `This task's failures changed since they were read, and cannot be written over (${taskId})`,
    );
    this.name = 'TaskFailuresMovedOnError';
  }
}
