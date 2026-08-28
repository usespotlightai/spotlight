import type { Task } from '@domain/aggregates/task.aggregate';
import type { Station } from '@domain/entities/station.entity';
import type { RunId } from '@domain/value-objects/run-id.vo';

export const TASK_DISPATCH = Symbol('TASK_DISPATCH');

export interface TaskDispatchPort {
  dispatch(input: { task: Task; station: Station }): Promise<RunId | null>;
}
