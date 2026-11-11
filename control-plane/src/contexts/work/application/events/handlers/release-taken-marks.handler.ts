import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { Task } from '@work/domain/aggregates/task.aggregate';
import type { TaskMarked } from '@work/domain/events/task-marked.event';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import { markHolderAmong } from '@work/domain/services/mark-holders';
import type { Mark } from '@work/domain/value-objects/mark.vo';

export class ReleaseTakenMarks {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly transaction: TransactionPort,
  ) {}

  async on(event: TaskMarked): Promise<void> {
    const holders = await this.tasks.holdingMark(event.workspaceId, event.mark);
    const holder = markHolderAmong(event.mark, holders);

    if (!holder) {
      return;
    }

    for (const each of holders) {
      if (!each.equals(holder)) {
        await this.release(each.id, event.mark, holder);
      }
    }
  }

  private async release(
    taskId: TaskId,
    mark: Mark,
    holder: Task,
  ): Promise<void> {
    await this.transaction.inTransaction(async () => {
      const task = await this.tasks.find(taskId);

      if (task && markHolderAmong(mark, [task, holder]) === holder) {
        await this.tasks.save(task.releaseMark(mark));
      }
    });
  }
}
