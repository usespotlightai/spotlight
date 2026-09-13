export class TaskMovedOnError extends Error {
  readonly violation = 'conflict' as const;

  constructor(id: string) {
    super(
      `This task has been worked on since it was read, and cannot be written over (${id})`,
    );
    this.name = 'TaskMovedOnError';
  }
}
