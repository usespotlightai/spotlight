import type { NotifyTask } from '@integrations/application/services/notify-task.service';
import { IntegrationTaskViewMapper } from '@integrations/infrastructure/acl/integration-task-view.mapper';
import type { TaskMark } from '@work/application/contracts/happenings.contract';
import type { IntegrationTaskViewDto } from '@work/application/dto/integration-task-view.dto';
import type { TaskNoticesPort } from '@work/application/ports/task-notices.port';

export class TaskNotices implements TaskNoticesPort {
  constructor(private readonly notices: NotifyTask) {}

  notify(
    task: IntegrationTaskViewDto,
    event: string,
  ): Promise<readonly TaskMark[]> {
    return this.notices.notify(
      IntegrationTaskViewMapper.toView(task, null),
      event,
    );
  }
}
