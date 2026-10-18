import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import type { OutboundTaskNotifierPort } from '@work/application/ports/outbound-task-notifier.port';
import { reassignTaskMarks } from '@work/application/services/task-marks';
import type { PullRequestOpened } from '@work/domain/events/pull-request-opened.event';
import type { TaskAsked } from '@work/domain/events/task-asked.event';
import type { TaskOpened } from '@work/domain/events/task-opened.event';
import type { TaskRepository } from '@work/domain/repositories/task.repository';

export class NotifyOutsideTools {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly notifier: OutboundTaskNotifierPort,
    private readonly transaction: TransactionPort,
  ) {}

  async on(event: TaskOpened | PullRequestOpened | TaskAsked): Promise<void> {
    if (event.kind === 'task.opened' && !event.fromIntegration) {
      return;
    }

    const task = await this.tasks.find(event.taskId);

    if (!task) {
      return;
    }

    const notified = await this.notifier.notify(task, event.kind);

    if (notified.length === 0) {
      return;
    }

    await this.transaction.inTransaction(async () => {
      const current = await this.tasks.find(event.taskId);

      if (!current) {
        return;
      }

      const marked = notified.reduce(
        (markedTask, mark) => markedTask.markedBy(mark),
        current,
      );

      await reassignTaskMarks(this.tasks, marked);
      await this.tasks.save(marked);
    });
  }
}
