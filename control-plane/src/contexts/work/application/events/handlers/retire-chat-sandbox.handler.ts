import type { SandboxRetirementPort } from '@runners/application/ports/sandbox-retirement.port';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { WorkRequesters } from '@work/application/services/work-requesters';
import type { ChatRepository } from '@work/domain/repositories/chat.repository';
import type { ChatId } from '@work/domain/value-objects/chat-id.vo';

export class RetireChatSandbox {
  constructor(
    private readonly chats: ChatRepository,
    private readonly sandboxes: SandboxRetirementPort,
  ) {}

  async on(event: { chatId: ChatId; workspaceId: WorkspaceId }): Promise<void> {
    const chat = await this.chats.find(event.chatId);

    if (!chat || chat.keepsNoLiveWorkingCopy) {
      await this.sandboxes.retire(
        event.workspaceId.value,
        WorkRequesters.chatWorkingCopyKey(event.chatId),
      );
    }
  }
}
