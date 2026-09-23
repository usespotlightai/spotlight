import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';

export const TASK_DECISIONS = Symbol('TASK_DECISIONS');

export interface BriefedDecision {
  readonly kind: string;
  readonly title: string;
  readonly why: string;
  readonly paths: readonly string[];
  readonly disputes: readonly string[];
}

export interface TaskDecisionsPort {
  ofTask(taskId: TaskId): Promise<readonly BriefedDecision[]>;
}
