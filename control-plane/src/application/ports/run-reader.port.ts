import type { TaskId } from '@domain/value-objects/task-id.vo';
import type { UserId } from '@domain/value-objects/user-id.vo';

/** A run is over in seconds, so this is usually read after the fact. */
export interface TaskRunSummary {
  readonly id: string;
  readonly state: string;
  readonly attempt: number;
  readonly exitCode: number | null;
  readonly startedAt: Date;
  readonly updatedAt: Date;
}

export const RUN_READER = Symbol('RUN_READER');

export interface RunReaderPort {
  listForTask(taskId: TaskId, viewerId: UserId): Promise<TaskRunSummary[]>;
}
