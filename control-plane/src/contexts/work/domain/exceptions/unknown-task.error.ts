export class UnknownTaskError extends Error {
  readonly violation = 'not-found' as const;

  constructor(taskId: string) {
    super(`Task ${taskId} not found.`);
    this.name = 'UnknownTaskError';
  }
}
