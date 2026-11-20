import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import type { ChatDispatching } from '@work/application/services/dispatch-chat.service';
import type { TaskNotedForChat } from '@work/domain/events/task-noted-for-chat.event';
import type { ChatRepository } from '@work/domain/repositories/chat.repository';
import { ChatMessageBody } from '@work/domain/value-objects/chat-message-body.vo';

export class TellChatOfTask {
  constructor(
    private readonly chats: ChatRepository,
    private readonly dispatch: ChatDispatching,
    private readonly transaction: TransactionPort,
  ) {}

  async on(event: TaskNotedForChat): Promise<void> {
    await this.transaction.inTransaction(async () => {
      const chat = await this.chats.find(event.chatId);

      if (!chat) {
        return;
      }

      const heard = chat.heard({
        task: event.taskId,
        body: ChatMessageBody.cut(event.body),
        wakes: event.wakes,
        at: event.at,
      });

      await this.chats.save(
        heard.wantsFollowUp ? await this.dispatch.takenUp(heard) : heard,
      );
    });
  }
}
