import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { Chat } from '@work/domain/aggregates/chat.aggregate';
import type { ChatId } from '@work/domain/value-objects/chat-id.vo';
import type { CorrelationKeys } from '@work/domain/value-objects/correlation-keys.vo';

export interface ChatRepository {
  add(chat: Chat): Promise<void>;

  save(chat: Chat): Promise<void>;

  find(id: ChatId): Promise<Chat | null>;

  findByMarks(
    workspaceId: WorkspaceId,
    correlationKeys: CorrelationKeys,
  ): Promise<Chat | null>;
}
