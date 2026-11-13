import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { bindableTaskEventOf } from '@work/application/mappers/bindable-task-event.mapper';
import type { OutboundTaskNotifier } from '@work/application/services/outside-task-notices.service';
import type { Task } from '@work/domain/aggregates/task.aggregate';
import type { InboxRequestOpened } from '@work/domain/events/inbox-request-opened.event';
import type { InboxRequestRepository } from '@work/domain/repositories/inbox-request.repository';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import {
  type NoticedTaskEvent,
  notifiesOutsideTools,
} from '@work/domain/services/outside-notices';
import type { Mark } from '@work/domain/value-objects/mark.vo';

export class NotifyOutsideTools {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly inboxRequests: InboxRequestRepository,
    private readonly notifier: OutboundTaskNotifier,
    private readonly transaction: TransactionPort,
    private readonly clock: ClockPort,
  ) {}

  async on(event: NoticedTaskEvent): Promise<void> {
    if (!notifiesOutsideTools(event)) {
      return;
    }

    await this.notified(event.taskId, (task) =>
      this.notifier.notify(task, bindableTaskEventOf(event)),
    );
  }

  async onInboxRequestOpened(event: InboxRequestOpened): Promise<void> {
    const request = await this.inboxRequests.find(event.inboxRequestId);

    if (!request?.open) {
      return;
    }

    await this.notified(event.taskId, (task) =>
      this.notifier.notifyRequest(task, request),
    );
  }

  private async notified(
    taskId: TaskId,
    notify: (task: Task) => Promise<readonly Mark[]>,
  ): Promise<void> {
    const task = await this.tasks.find(taskId);

    if (!task) {
      return;
    }

    const notified = await notify(task);

    if (notified.length === 0) {
      return;
    }

    await this.transaction.inTransaction(async () => {
      const current = await this.tasks.find(taskId);

      if (!current) {
        return;
      }

      const now = this.clock.now();
      const marked = notified.reduce(
        (markedTask, mark) => markedTask.markedBy(mark, now),
        current,
      );

      await this.tasks.save(marked);
    });
  }
}
