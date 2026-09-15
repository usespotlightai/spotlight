import type { ChatToolContext } from '@application/ports/integration-tools.port';
import type { PendingSaying, RunWork } from '@application/services/run-work';
import type { Chat } from '@domain/aggregates/chat.aggregate';
import type { Run } from '@domain/aggregates/run.aggregate';
import type { ChatRepository } from '@domain/repositories/chat.repository';
import type { LineRepository } from '@domain/repositories/line.repository';
import type { Attachment } from '@domain/value-objects/attachment.vo';
import { MessagePosition } from '@domain/value-objects/message-position.vo';
import type { Repository } from '@domain/value-objects/repository.vo';
import type { WorkspaceId } from '@domain/value-objects/workspace-id.vo';

export class ChatRunWork implements RunWork {
  constructor(
    private readonly run: Run,
    private readonly chat: Chat,
    private readonly chats: ChatRepository,
    private readonly lines: LineRepository,
  ) {}

  get workspaceId(): WorkspaceId {
    return this.chat.workspaceId;
  }

  pending(): readonly PendingSaying[] {
    return this.chat.undelivered.map((message) => ({
      position: message.position.value,
      body: message.body.value,
      attachments: message.attachments,
    }));
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

  async toolContext(): Promise<ChatToolContext> {
    return {
      kind: 'chat',
      run: this.run,
      chat: this.chat,
      lines: await this.lines.ofTeam(this.chat.teamId),
    };
  }
}
