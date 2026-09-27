export class TaskAsideMovedOnError extends Error {
  readonly violation = 'conflict' as const;

  constructor(id: string) {
    super(
      `This task aside changed since it was read, and cannot be written over (${id})`,
    );
    this.name = 'TaskAsideMovedOnError';
  }
}
