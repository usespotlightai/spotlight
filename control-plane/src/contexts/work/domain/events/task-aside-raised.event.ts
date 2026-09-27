import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TaskAsideId } from '@work/domain/value-objects/task-aside-id.vo';

export class TaskAsideRaised implements DomainEvent {
  readonly kind = 'task-aside.raised';

  constructor(
    readonly asideId: TaskAsideId,
    readonly taskId: TaskId,
    readonly form: string,
    readonly about: string,
  ) {}
}
