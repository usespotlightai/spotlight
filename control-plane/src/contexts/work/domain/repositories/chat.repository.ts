import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { Chat } from '@work/domain/aggregates/chat.aggregate';
import type { ChatId } from '@work/domain/value-objects/chat-id.vo';
import type { CorrelationKeys } from '@work/domain/value-objects/correlation-keys.vo';

export const CHAT_REPOSITORY = Symbol('CHAT_REPOSITORY');

export interface ChatRepository {
  add(chat: Chat): Promise<void>;

  save(chat: Chat): Promise<void>;

  remove(chat: Chat): Promise<void>;

  find(id: ChatId): Promise<Chat | null>;

  ofTeam(teamId: TeamId): Promise<Chat[]>;

  findByCorrelation(
    workspaceId: WorkspaceId,
    correlationKeys: CorrelationKeys,
  ): Promise<Chat | null>;
}
