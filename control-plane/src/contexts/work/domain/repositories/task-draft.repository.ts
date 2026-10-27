import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TaskDraft } from '@work/domain/aggregates/task-draft.aggregate';

export interface TaskDraftRepository {
  find(taskId: TaskId): Promise<TaskDraft | null>;

  // Throws DraftAlreadySentError when another send moved the draft on since it was loaded.
  save(draft: TaskDraft): Promise<void>;
}
