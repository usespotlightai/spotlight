export class TaskPullRequestVersionConflictError extends Error {
  readonly kind = 'conflict' as const;

  constructor(taskId: string) {
    super(
      `The pull request of task ${taskId} changed since you loaded it. Please reload and try again.`,
    );
    this.name = 'TaskPullRequestVersionConflictError';
  }
}
