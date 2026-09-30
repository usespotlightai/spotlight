export class TaskDeliveryMovedOnError extends Error {
  readonly violation = 'conflict' as const;

  constructor(taskId: string) {
    super(
      `This task's delivery changed since it was read, and cannot be written over (${taskId})`,
    );
    this.name = 'TaskDeliveryMovedOnError';
  }
}
