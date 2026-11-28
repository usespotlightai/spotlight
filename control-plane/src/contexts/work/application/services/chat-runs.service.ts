import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type {
  ChatRun,
  ChatRunRequester,
  ChatRunsPort,
} from '@work/application/ports/chat-runs.port';
import { WorkRequesters } from '@work/application/services/work-requesters';
import type { ChatRepository } from '@work/domain/repositories/chat.repository';
import type { DispatchRepository } from '@work/domain/repositories/dispatch.repository';

export class ChatRuns implements ChatRunsPort {
  constructor(
    private readonly dispatches: DispatchRepository,
    private readonly chats: ChatRepository,
  ) {}

  async of(
    runId: string,
    requester: ChatRunRequester,
  ): Promise<ChatRun | null> {
    if (!WorkRequesters.chatOf(requester)) {
      return null;
    }

    const subject = (await this.dispatches.find(RunId.of(runId)))?.subject;

    if (subject?.kind !== 'chat') {
      return null;
    }

    const chat = await this.chats.find(subject.chatId);

    return chat
      ? {
          runId,
          workspaceId: chat.workspaceId.value,
          teamId: chat.teamId.value,
          chatId: chat.id.value,
          harness: chat.harness.value,
          model: chat.model?.value ?? null,
          repositories: chat.repositories.map((each) => each.value),
        }
      : null;
  }
}
