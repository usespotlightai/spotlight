import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';

export const REVIEWING_LOCKS = Symbol('REVIEWING_LOCKS');

export interface ReviewingLocksPort {
  signallingFor<T>(taskId: TaskId, work: () => Promise<T>): Promise<T>;
}
