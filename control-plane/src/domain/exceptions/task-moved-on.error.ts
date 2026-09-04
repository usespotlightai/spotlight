/**
 * Somebody else wrote this task between it being read and being written, so
 * what was decided was decided against a task that no longer stands.
 */
export class TaskMovedOnError extends Error {
  readonly violation = 'conflict' as const;

  constructor(id: string) {
    super(`This task has been worked on since it was read, and cannot be written over (${id})`);
    this.name = 'TaskMovedOnError';
  }
}
