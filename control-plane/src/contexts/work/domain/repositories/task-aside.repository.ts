import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TaskAside } from '@work/domain/aggregates/task-aside.aggregate';
import type { AsideAbout } from '@work/domain/value-objects/aside-about.vo';
import type { AsideForm } from '@work/domain/value-objects/aside-form';
import type { TaskAsideId } from '@work/domain/value-objects/task-aside-id.vo';

export interface TaskAsideRepository {
  add(aside: TaskAside): Promise<void>;

  save(aside: TaskAside): Promise<void>;

  find(id: TaskAsideId): Promise<TaskAside | null>;

  about(
    taskId: TaskId,
    form: AsideForm,
    about: AsideAbout,
  ): Promise<TaskAside | null>;
}
