import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { ChatDispatching } from '@work/application/services/chat-dispatch';
import type { RunOutcomes } from '@work/application/services/run-outcomes';
import type { Chat } from '@work/domain/aggregates/chat.aggregate';
import type { RunAbandoned } from '@work/domain/events/run-abandoned.event';
import type { RunCompleted } from '@work/domain/events/run-completed.event';
import type { ChatRepository } from '@work/domain/repositories/chat.repository';
import type { ChatId } from '@work/domain/value-objects/chat-id.vo';

export class ChatOutcomes implements RunOutcomes {
  constructor(
    private readonly chats: ChatRepository,
    private readonly dispatch: ChatDispatching,
  ) {}

  async onRunCompleted(event: RunCompleted): Promise<void> {
    const chat = await this.waiting(event.runId, event.chatId);

    if (!chat) {
      return;
    }

    const ended = chat.runEnded(event.runId, {
      session: event.session,
      workedBy: event.workedBy,
      stopped: event.outcome.stopped,
    });

    await this.chats.save(
      ended.followsUp ? await this.dispatch.takenUp(ended.chat) : ended.chat,
    );
  }

  async onRunAbandoned(event: RunAbandoned): Promise<void> {
    const chat = await this.waiting(event.runId, event.chatId);

    if (chat) {
      await this.chats.save(chat.runKeptNothing(event.runId));
    }
  }

  private async waiting(
    runId: RunId,
    chatId: ChatId | null,
  ): Promise<Chat | null> {
    if (!chatId) {
      return null;
    }

    const chat = await this.chats.find(chatId);

    return chat?.hasCurrentRun(runId) ? chat : null;
  }
}
