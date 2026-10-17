import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import type { OutboundTaskNotifierPort } from '@work/application/ports/outbound-task-notifier.port';
import { takeTaskMarks } from '@work/application/services/task-marks';
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
    if (event.kind === 'task.opened' && !event.heard) {
      return;
    }

    const task = await this.tasks.find(event.taskId);

    if (!task) {
      return;
    }

    const kept = await this.notifier.notify(task, event.kind);

    if (kept.length === 0) {
      return;
    }

    await this.transaction.inTransaction(async () => {
      const current = await this.tasks.find(event.taskId);

      if (!current) {
        return;
      }

      const marked = kept.reduce(
        (markedTask, mark) => markedTask.markedBy(mark),
        current,
      );

      await takeTaskMarks(this.tasks, marked);
      await this.tasks.save(marked);
    });
  }
}
