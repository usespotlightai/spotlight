export class TaskDeliveryMovedOnError extends Error {
  readonly violation = 'conflict' as const;

  constructor(taskId: string) {
    super(
      `Delivery of task ${taskId} changed since you loaded it. Please reload and try again.`,
    );
    this.name = 'TaskDeliveryMovedOnError';
  }
}
