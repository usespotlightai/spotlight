import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';

export const STICKY_COMMENT_POSTER = Symbol('STICKY_COMMENT_POSTER');

export interface StickyCommentPosterPort {
  ofRun(runId: RunId): Promise<void>;

  ofTask(taskId: TaskId): Promise<void>;
}
