import type { RunEndedIntegrationEvent } from '@shared-kernel/application/integration-events/run-ended.integration-event';
import type { ChatDispatching } from '@work/application/services/dispatch-chat.service';
import {
  RunEndedFacts,
  type RunEndingReactions,
} from '@work/application/services/run-ending-reactions';
import { WorkRequesters } from '@work/application/services/work-requesters';
import type { Chat } from '@work/domain/aggregates/chat.aggregate';
import type { ChatRepository } from '@work/domain/repositories/chat.repository';
import type { DispatchEndedBy } from '@work/domain/value-objects/dispatch-ending.vo';

export class ChatOutcomes implements RunEndingReactions {
  constructor(
    private readonly chats: ChatRepository,
    private readonly dispatch: ChatDispatching,
  ) {}

  private readonly reactions: Record<
    DispatchEndedBy,
    (event: RunEndedIntegrationEvent) => Promise<void>
  > = {
    turn: (event) => this.completed(event),
    exhaustion: (event) => this.exhausted(event),
    cancellation: () => Promise.resolve(),
  };

  async onRunEnded(event: RunEndedIntegrationEvent): Promise<void> {
    await this.reactions[RunEndedFacts.ending(event).endedBy](event);
  }

  private async completed(event: RunEndedIntegrationEvent): Promise<void> {
    const runId = RunEndedFacts.runId(event);
    const chat = await this.waiting(event);

    if (!chat) {
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

  private async exhausted(event: RunEndedIntegrationEvent): Promise<void> {
    const chat = await this.waiting(event);

    if (chat) {
      await this.chats.save(
        chat.runEndedWithoutSession(RunEndedFacts.runId(event)),
      );
    }
  }

  private async waiting(event: RunEndedIntegrationEvent): Promise<Chat | null> {
    const chatId = WorkRequesters.chatOf(event.requester);

    if (!chatId) {
      return null;
    }

    const chat = await this.chats.find(chatId);

    return chat?.hasCurrentRun(RunEndedFacts.runId(event)) ? chat : null;
  }
}
