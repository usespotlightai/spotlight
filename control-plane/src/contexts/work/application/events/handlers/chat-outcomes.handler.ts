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

    if (!event.session) {
      await this.chats.save(chat.runKeptNothing(event.runId));
      return;
    }

    const worked = chat
      .endedRun(event.runId)
      .workedIn(event.session, event.workedBy);

    await this.chats.save(
      event.outcome.stopped ? worked : await this.followedUp(worked),
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

    return chat?.heldBy(runId) ? chat : null;
  }

  private async followedUp(chat: Chat): Promise<Chat> {
    return chat.wantsFollowUp ? this.dispatch.takenUp(chat) : chat;
  }
}
