import type { Line } from '@domain/aggregates/line.aggregate';
import type { Task } from '@domain/aggregates/task.aggregate';
import type { RunId } from '@domain/value-objects/run-id.vo';

export const TASK_DISPATCH = Symbol('TASK_DISPATCH');

export interface TaskDispatching {
  dispatch(input: { task: Task; line: Line }): Promise<RunId | null>;
}
