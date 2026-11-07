import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { Task } from '@work/domain/aggregates/task.aggregate';
import type { LineMap } from '@work/domain/value-objects/line-map.vo';

export const TASK_DISPATCH = Symbol('TASK_DISPATCH');

export interface TaskDispatching {
  runIdFor(input: { task: Task; line: LineMap }): Promise<RunId | null>;
}
