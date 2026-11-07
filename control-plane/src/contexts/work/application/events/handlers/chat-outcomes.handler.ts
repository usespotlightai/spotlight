import type { RunEndedIntegrationEvent } from '@shared-kernel/application/integration-events/run-ended.integration-event';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { ChatDispatching } from '@work/application/services/dispatch-chat.service';
import {
  RunEndedFacts,
  type RunEndingReactions,
} from '@work/application/services/run-ending-reactions';
import { WorkRequesters } from '@work/application/services/work-requesters';
import type { Chat } from '@work/domain/aggregates/chat.aggregate';
import type { ChatRepository } from '@work/domain/repositories/chat.repository';
import type { ChatId } from '@work/domain/value-objects/chat-id.vo';

export class ChatOutcomes implements RunEndingReactions {
  constructor(
    private readonly chats: ChatRepository,
    private readonly dispatch: ChatDispatching,
  ) {}

  async onRunEnded(event: RunEndedIntegrationEvent): Promise<void> {
    if (event.outcome === 'cancelled') {
      return;
    }

    const runId = RunEndedFacts.runId(event);
    const chat = await this.waiting(
      runId,
      WorkRequesters.chatOf(event.requester),
    );

    if (!chat) {
      return;
    }

    if (event.outcome === 'exhausted') {
      await this.chats.save(chat.runEndedWithoutSession(runId));
      return;
    }

    const ended = chat.runEnded(runId, {
      session: RunEndedFacts.session(event),
      claimedBy: RunEndedFacts.claimedBy(event),
    });

    await this.chats.save(
      ended.followsUp ? await this.dispatch.takenUp(ended.chat) : ended.chat,
    );
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
