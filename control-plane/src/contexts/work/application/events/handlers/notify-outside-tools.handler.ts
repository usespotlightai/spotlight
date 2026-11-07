import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { bindableTaskEventOf } from '@work/application/mappers/bindable-task-event.mapper';
import type { OutboundTaskNotifier } from '@work/application/services/outside-task-notices.service';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import {
  type NoticedTaskEvent,
  notifiesOutsideTools,
} from '@work/domain/services/outside-notices';

export class NotifyOutsideTools {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly notifier: OutboundTaskNotifier,
    private readonly transaction: TransactionPort,
    private readonly clock: ClockPort,
  ) {}

  async on(event: NoticedTaskEvent): Promise<void> {
    if (!notifiesOutsideTools(event)) {
      return;
    }

    const task = await this.tasks.find(event.taskId);

    if (!task) {
      return;
    }

    const notified = await this.notifier.notify(
      task,
      bindableTaskEventOf(event),
    );

    if (notified.length === 0) {
      return;
    }

    await this.transaction.inTransaction(async () => {
      const current = await this.tasks.find(event.taskId);

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
