import type { ChatDispatching } from '@application/services/chat-dispatch';
import type { RunOutcomes } from '@application/services/run-outcomes';
import type { Chat } from '@domain/aggregates/chat.aggregate';
import type { RunAbandoned } from '@domain/events/run-abandoned.event';
import type { RunCompleted } from '@domain/events/run-completed.event';
import type { ChatRepository } from '@domain/repositories/chat.repository';
import type { ChatId } from '@domain/value-objects/chat-id.vo';
import type { RunId } from '@domain/value-objects/run-id.vo';

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

    const ended = chat.endedRun(event.runId);
    const worked = event.session
      ? ended.workedIn(event.session, event.workedBy)
      : ended;

    await this.chats.save(
      event.result.stopped ? worked : await this.followedUp(worked),
    );
  }

  async onRunAbandoned(event: RunAbandoned): Promise<void> {
    const chat = await this.waiting(event.runId, event.chatId);

    if (chat) {
      await this.chats.save(chat.endedRun(event.runId));
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

    return chat?.currentRunId?.equals(runId) ? chat : null;
  }

  private async followedUp(chat: Chat): Promise<Chat> {
    return chat.undelivered.length > 0 ? this.dispatch.takenUp(chat) : chat;
  }
}
