import type { LeasedRun } from '@runs/application/ports/run-leases.port';
import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { GitService } from '@work/application/ports/git-gateway.port';
import type { ConnectionMissingDto } from '@work/application/ports/integration-tool-calls.port';
import type { ChatToolContext } from '@work/application/ports/integration-tools.port';
import { ChatRefused } from '@work/application/rendering/chat-refused';
import type {
  Cleared,
  ConnectionAsked,
  PermissionCleared,
  RunWork,
} from '@work/application/services/run-work';
import type { Chat } from '@work/domain/aggregates/chat.aggregate';
import type { ChatRepository } from '@work/domain/repositories/chat.repository';
import type { Attachment } from '@work/domain/value-objects/attachment.vo';
import type { DeclaredTool } from '@work/domain/value-objects/declared-tool.vo';
import { MessagePosition } from '@work/domain/value-objects/message-position.vo';

export class ChatRunWork implements RunWork {
  constructor(
    private readonly run: LeasedRun,
    private readonly chat: Chat,
    private readonly chats: ChatRepository,
  ) {}

  get workspaceId(): WorkspaceId {
    return this.chat.workspaceId;
  }

  async acknowledgeUpTo(position: number, at: Date): Promise<void> {
    await this.chats.save(
      this.chat.acknowledgeUpTo(
        this.run.runId,
        MessagePosition.of(position),
        at,
      ),
    );
  }

  attachment(attachmentId: string): Attachment | null {
    return (
      this.chat.sharedAttachments.find(
        (each) => each.id.value === attachmentId,
      ) ?? null
    );
  }

  async repositoryNamed(
    name: string,
    service: GitService,
  ): Promise<Repository | null> {
    return service === 'git-receive-pack'
      ? this.chat.pushableNamed(name)
      : this.chat.repositoryNamed(name);
  }

  async clearFor(declared: DeclaredTool): Promise<Cleared> {
    const refusal = this.chat.toolRefusal(declared);

    return refusal
      ? { kind: 'dismissed', reason: ChatRefused.text(refusal) }
      : { kind: 'approved', edited: null, returned: async () => {} };
  }

  async askToConnect(
    _declared: DeclaredTool,
    missing: ConnectionMissingDto,
  ): Promise<ConnectionAsked> {
    return {
      kind: 'denied',
      reason: ChatRefused.text(
        this.chat.connectionAskRefusal(missing.integrationName),
      ),
    };
  }

  async clearPermission(): Promise<PermissionCleared> {
    return 'dismissed';
  }

  async toolContext(): Promise<ChatToolContext> {
    return {
      kind: 'chat',
      runId: this.run.runId,
      workspaceId: this.chat.workspaceId,
      chatId: this.chat.id,
      teamId: this.chat.teamId,
      requester: this.chat.startedBy,
    };
  }
}
