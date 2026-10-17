import { HappenedMapper } from '@work/application/mappers/happened.mapper';
import type { OutboundTaskNotifierPort } from '@work/application/ports/outbound-task-notifier.port';
import type { TaskNoticesPort } from '@work/application/ports/task-notices.port';
import type { IntegrationTaskViews } from '@work/application/services/integration-task-views.service';
import type { Task } from '@work/domain/aggregates/task.aggregate';
import type { Mark } from '@work/domain/value-objects/mark.vo';

export class OutsideTaskNotices implements OutboundTaskNotifierPort {
  constructor(
    private readonly taskViews: IntegrationTaskViews,
    private readonly notices: TaskNoticesPort,
  ) {}

  async notify(task: Task, event: string): Promise<readonly Mark[]> {
    const view = await this.taskViews.of(task);

    return view
      ? (await this.notices.notify(view, event)).map(HappenedMapper.markOf)
      : [];
  }
}
