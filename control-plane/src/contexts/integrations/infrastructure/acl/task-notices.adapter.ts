import type { NotifyTask } from '@integrations/application/services/notify-task.service';
import { IntegrationTaskViewMapper } from '@integrations/infrastructure/acl/integration-task-view.mapper';
import type { BindableTaskEvent } from '@work/application/contracts/bindable-task-events.contract';
import type { TaskMark } from '@work/application/contracts/happenings.contract';
import type { IntegrationTaskViewDto } from '@work/application/dto/integration-task-view.dto';
import type {
  InboxRequestNoticeDto,
  TaskNoticesPort,
} from '@work/application/ports/task-notices.port';

export class TaskNotices implements TaskNoticesPort {
  constructor(private readonly notices: NotifyTask) {}

  notify(
    task: IntegrationTaskViewDto,
    event: BindableTaskEvent,
  ): Promise<readonly TaskMark[]> {
    return this.notices.notify(IntegrationTaskViewMapper.toView(task), event);
  }

  notifyRequest(
    task: IntegrationTaskViewDto,
    request: InboxRequestNoticeDto,
  ): Promise<readonly TaskMark[]> {
    return this.notices.notifyRequest(IntegrationTaskViewMapper.toView(task), {
      id: request.id,
      form: request.form,
    });
  }
}
