import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { RunFactsPort } from '@work/application/ports/run-facts.port';
import type {
  RunViewersPort,
  WatchedRun,
} from '@work/application/ports/run-viewers.port';
import type { ChatRepository } from '@work/domain/repositories/chat.repository';
import { ChatAccess } from '@work/domain/services/chat-access';
import { ChatId } from '@work/domain/value-objects/chat-id.vo';

export class RunAccess implements RunViewersPort {
  constructor(
    private readonly facts: RunFactsPort,
    private readonly chats: ChatRepository,
    private readonly access: WorkspaceAccessPort,
  ) {}

  async watchedBy(runId: RunId, viewer: UserId): Promise<WatchedRun | null> {
    const [run] = await this.facts.of([runId]);

    if (!run?.policy.listed) {
      return null;
    }

    if (run.subject?.kind === 'chat') {
      const chat = await this.chats.find(ChatId.of(run.subject.chatId));

      return chat && ChatAccess.readableBy(chat.startedBy, viewer) ? run : null;
    }

    return (await this.access.mayView(viewer, run.workspaceId)) ? run : null;
  }
}
