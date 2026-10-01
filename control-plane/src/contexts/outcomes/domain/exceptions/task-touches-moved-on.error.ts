export class TaskTouchesMovedOnError extends Error {
  readonly violation = 'conflict' as const;

  constructor(taskId: string) {
    super(
      `What people did with this task changed since it was read, and cannot be written over (${taskId})`,
    );
    this.name = 'TaskTouchesMovedOnError';
  }
}
