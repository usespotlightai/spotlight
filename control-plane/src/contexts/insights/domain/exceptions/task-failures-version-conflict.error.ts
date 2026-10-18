export class TaskFailuresVersionConflictError extends Error {
  readonly violation = 'conflict' as const;

  constructor(taskId: string) {
    super(
      `Failures of task ${taskId} changed since you loaded them. Please reload and try again.`,
    );
    this.name = 'TaskFailuresVersionConflictError';
  }
}
