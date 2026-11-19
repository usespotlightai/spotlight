import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { LineMapsPort } from '@work/application/ports/line-maps.port';
import type { ChatDeleted } from '@work/domain/events/chat-deleted.event';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import type { ChatId } from '@work/domain/value-objects/chat-id.vo';

export class ReleaseTasksOfDeletedChat {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly lines: Pick<LineMapsPort, 'findByStation'>,
    private readonly transaction: TransactionPort,
    private readonly clock: ClockPort,
  ) {}

  async on(event: ChatDeleted): Promise<void> {
    const held = await this.tasks.heldForChat(event.chatId);

    for (const task of held) {
      await this.released(task.id, event.chatId);
    }
  }

  private async released(taskId: TaskId, chat: ChatId): Promise<void> {
    await this.transaction.inTransaction(async () => {
      const task = await this.tasks.find(taskId);
      const line = task && (await this.lines.findByStation(task.stationId));

      if (!task || !line) {
        return;
      }

      await this.tasks.save(
        task.releasedByDeletedChat(chat, line, this.clock.now()),
      );
    });
  }
}
