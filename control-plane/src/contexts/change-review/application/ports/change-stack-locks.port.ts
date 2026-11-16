import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';

export const CHANGE_STACK_LOCKS = Symbol('CHANGE_STACK_LOCKS');

export interface ChangeStackLocksPort {
  stackingFor<T>(taskId: TaskId, work: () => Promise<T>): Promise<T>;
}
