import type { BindableTaskEvent } from '@work/application/contracts/bindable-task-events.contract';
import { HappenedMapper } from '@work/application/mappers/happened.mapper';
import type { InboxRequestFormName } from '@work/application/ports/inbox-requests.port';
import type { TaskNoticesPort } from '@work/application/ports/task-notices.port';
import type { IntegrationTaskViews } from '@work/application/services/integration-task-views.service';
import type { InboxRequest } from '@work/domain/aggregates/inbox-request.aggregate';
import type { Task } from '@work/domain/aggregates/task.aggregate';
import type { InboxRequestForm } from '@work/domain/value-objects/inbox-request-form';
import type { Mark } from '@work/domain/value-objects/mark.vo';

const FORMS: Readonly<Record<InboxRequestForm, InboxRequestFormName>> = {
  memories: 'memories',
  grade: 'grade',
  alert: 'alert',
};

export interface OutboundTaskNotifier {
  notify(task: Task, event: BindableTaskEvent): Promise<readonly Mark[]>;

  notifyRequest(task: Task, request: InboxRequest): Promise<readonly Mark[]>;
}

export class OutsideTaskNotices implements OutboundTaskNotifier {
  constructor(
    private readonly taskViews: IntegrationTaskViews,
    private readonly notices: TaskNoticesPort,
  ) {}

  async notify(task: Task, event: BindableTaskEvent): Promise<readonly Mark[]> {
    const view = await this.taskViews.of(task);

    return view
      ? (await this.notices.notify(view, event)).map((each) =>
          HappenedMapper.markOf(each),
        )
      : [];
  }

  async notifyRequest(
    task: Task,
    request: InboxRequest,
  ): Promise<readonly Mark[]> {
    const view = await this.taskViews.of(task);

    return view
      ? (
          await this.notices.notifyRequest(view, {
            id: request.id.value,
            form: FORMS[request.form],
          })
        ).map((each) => HappenedMapper.markOf(each))
      : [];
  }
}
