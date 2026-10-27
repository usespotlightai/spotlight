import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { DraftGeneration } from '@work/domain/value-objects/draft-generation.vo';

export const LIVE_TASK_DRAFTS = Symbol('LIVE_TASK_DRAFTS');

export interface LiveTaskDraftsPort {
  // The people who typed in the draft since it was last sent.
  writers(taskId: TaskId): Promise<UserId[]>;

  // Tells the people writing the draft what was sent, so their composers start the next one.
  sent(taskId: TaskId, next: DraftGeneration, body: string): Promise<void>;
}
