export class UnknownTaskError extends Error {
  readonly violation = 'not-found' as const;

  constructor(taskId: string) {
    super(`There is no task ${taskId}`);
    this.name = 'UnknownTaskError';
  }
}
