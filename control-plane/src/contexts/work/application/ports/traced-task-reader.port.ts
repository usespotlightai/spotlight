import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';

export const TRACED_TASK_READER = Symbol('TRACED_TASK_READER');

export interface TracedTask {
  readonly taskId: string;
  readonly title: string;
  readonly teamId: string;
}

// Not viewer-scoped: the chat checks each task is of its own team.
export interface TracedTaskReaderPort {
  of(taskIds: readonly TaskId[]): Promise<TracedTask[]>;
}
