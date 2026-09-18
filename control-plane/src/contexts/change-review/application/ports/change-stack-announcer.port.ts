import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';

export const CHANGE_STACK_ANNOUNCER = Symbol('CHANGE_STACK_ANNOUNCER');

export interface ChangeStackAnnouncerPort {
  ofRun(runId: RunId): Promise<void>;

  ofTask(taskId: TaskId): Promise<void>;
}
