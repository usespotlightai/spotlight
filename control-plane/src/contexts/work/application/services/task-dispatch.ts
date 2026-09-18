import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { Line } from '@work/domain/aggregates/line.aggregate';
import type { Task } from '@work/domain/aggregates/task.aggregate';

export const TASK_DISPATCH = Symbol('TASK_DISPATCH');

export interface TaskDispatching {
  runIdFor(input: { task: Task; line: Line }): Promise<RunId | null>;
}
