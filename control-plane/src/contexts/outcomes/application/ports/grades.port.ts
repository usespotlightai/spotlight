import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';

export const GRADES = Symbol('OUTCOMES_GRADES');

export interface GradesPort {
  ask(taskId: TaskId, runId: RunId): Promise<void>;

  resolve(taskId: TaskId, runId: RunId): Promise<void>;
}
