import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';

export const TASK_ASIDES = Symbol('TASK_ASIDES');

export interface AsideOf {
  readonly taskId: TaskId;
  readonly form: string;
  readonly about: string;
}

export interface TaskAsidesPort {
  raise(aside: AsideOf): Promise<void>;

  reopen(aside: AsideOf): Promise<void>;

  settle(aside: AsideOf): Promise<void>;

  idOf(aside: AsideOf): Promise<string | null>;
}
