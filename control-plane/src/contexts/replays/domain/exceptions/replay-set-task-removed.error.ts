export class ReplaySetTaskRemovedError extends Error {
  readonly kind = 'conflict' as const;

  constructor(taskId: string) {
    super(`Task ${taskId} was removed from the replay set by a person.`);
    this.name = 'ReplaySetTaskRemovedError';
  }
}
