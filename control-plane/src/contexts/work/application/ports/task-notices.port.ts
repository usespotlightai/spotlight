import type { BindableTaskEvent } from '@work/application/contracts/bindable-task-events.contract';
import type { TaskMark } from '@work/application/contracts/happenings.contract';
import type { IntegrationTaskViewDto } from '@work/application/dto/integration-task-view.dto';
import type { InboxRequestFormName } from '@work/application/ports/inbox-requests.port';

export const TASK_NOTICES = Symbol('TASK_NOTICES');

export interface InboxRequestNoticeDto {
  readonly id: string;
  readonly form: InboxRequestFormName;
}

export interface TaskNoticesPort {
  notify(
    task: IntegrationTaskViewDto,
    event: BindableTaskEvent,
  ): Promise<readonly TaskMark[]>;

  notifyRequest(
    task: IntegrationTaskViewDto,
    request: InboxRequestNoticeDto,
  ): Promise<readonly TaskMark[]>;
}
