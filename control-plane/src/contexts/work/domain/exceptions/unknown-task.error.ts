export class UnknownTaskError extends Error {
  readonly kind = 'not-found' as const;

  constructor(taskId: string) {
    super(`Task ${taskId} not found.`);
    this.name = 'UnknownTaskError';
  }
}
