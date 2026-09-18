import type { DispatchChat } from '@work/application/services/dispatch-chat.service';
import type { ChatHandedToRun } from '@work/domain/events/chat-handed-to-run.event';
import type { ChatRepository } from '@work/domain/repositories/chat.repository';
import type { RunRepository } from '@work/domain/repositories/run.repository';

export class EnqueueChatRun {
  constructor(
    private readonly chats: ChatRepository,
    private readonly runs: RunRepository,
    private readonly dispatching: DispatchChat,
  ) {}

  async on(event: ChatHandedToRun): Promise<void> {
    const chat = await this.chats.find(event.chatId);

    if (!chat?.currentRunId?.equals(event.runId)) {
      return;
    }

    if (await this.runs.findById(event.runId)) {
      return;
    }

    if (await this.dispatching.enqueue(chat, event.runId)) {
      return;
    }

    await this.chats.save(chat.runNeverStarted(event.runId));
  }
}
