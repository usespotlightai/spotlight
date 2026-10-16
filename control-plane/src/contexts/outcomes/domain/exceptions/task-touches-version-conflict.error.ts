export class TaskTouchesVersionConflictError extends Error {
  readonly violation = 'conflict' as const;

  constructor(taskId: string) {
    super(
      `People’s actions on task ${taskId} changed since you loaded them. Please reload and try again.`,
    );
    this.name = 'TaskTouchesVersionConflictError';
  }
}
