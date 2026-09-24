import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { ChatToolContext } from '@work/application/ports/integration-tools.port';
import type {
  Cleared,
  PermissionCleared,
  RunWork,
} from '@work/application/services/run-work';
import type { Chat } from '@work/domain/aggregates/chat.aggregate';
import type { Run } from '@work/domain/aggregates/run.aggregate';
import type { ChatRepository } from '@work/domain/repositories/chat.repository';
import type { Attachment } from '@work/domain/value-objects/attachment.vo';
import type { DeclaredTool } from '@work/domain/value-objects/declared-tool.vo';
import { MessagePosition } from '@work/domain/value-objects/message-position.vo';

export class ChatRunWork implements RunWork {
  constructor(
    private readonly run: Run,
    private readonly chat: Chat,
    private readonly chats: ChatRepository,
  ) {}

  get workspaceId(): WorkspaceId {
    return this.chat.workspaceId;
  }

  async deliverUpTo(position: number, at: Date): Promise<void> {
    await this.chats.save(
      this.chat.deliveredUpTo(MessagePosition.of(position), at),
    );
  }

  gave(attachmentId: string): Attachment | null {
    return (
      this.chat.allAttachments.find((each) => each.id.value === attachmentId) ??
      null
    );
  }

  async repositoryNamed(name: string): Promise<Repository | null> {
    return this.chat.repositoryNamed(name);
  }

  async clearFor(declared: DeclaredTool): Promise<Cleared> {
    return declared.approval
      ? {
          kind: 'refused',
          reason: `${declared.tool.value} has to be approved by a person on a task, and a chat has nobody to put it to.`,
        }
      : { kind: 'given', returned: async () => {} };
  }

  async clearPermission(): Promise<PermissionCleared> {
    return 'refused';
  }

  async toolContext(): Promise<ChatToolContext> {
    return {
      kind: 'chat',
      runId: this.run.id,
      workspaceId: this.chat.workspaceId,
      chatId: this.chat.id,
      teamId: this.chat.teamId,
    };
  }
}
