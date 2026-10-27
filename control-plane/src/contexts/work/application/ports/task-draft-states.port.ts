import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';

export interface StoredDraft {
  readonly state: Uint8Array | null;
  readonly generation: number;
}

export const TASK_DRAFT_STATES = Symbol('TASK_DRAFT_STATES');

export interface TaskDraftStatesPort {
  read(taskId: TaskId): Promise<StoredDraft>;

  keep(taskId: TaskId, state: Uint8Array): Promise<void>;
}
