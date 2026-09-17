import { HappenedMapper } from '@work/application/mappers/happened.mapper';
import type { OutboundTaskNotifierPort } from '@work/application/ports/outbound-task-notifier.port';
import type { TaskNoticesPort } from '@work/application/ports/task-notices.port';
import type { TaskBindings } from '@work/application/services/task-bindings.service';
import type { Task } from '@work/domain/aggregates/task.aggregate';
import type { Mark } from '@work/domain/value-objects/mark.vo';

export class OutsideTaskNotices implements OutboundTaskNotifierPort {
  constructor(
    private readonly bindings: TaskBindings,
    private readonly notices: TaskNoticesPort,
  ) {}

  async notify(task: Task, event: string): Promise<readonly Mark[]> {
    const bound = await this.bindings.of(task);

    return bound
      ? (await this.notices.notify(bound, event)).map(HappenedMapper.markOf)
      : [];
  }
}
