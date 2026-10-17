import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { Chat } from '@work/domain/aggregates/chat.aggregate';
import { UnknownChatError } from '@work/domain/exceptions/unknown-chat.error';
import type { ChatRepository } from '@work/domain/repositories/chat.repository';
import { ChatId } from '@work/domain/value-objects/chat-id.vo';

export class ChatLoader {
  constructor(private readonly chats: ChatRepository) {}

  async inTeam(teamId: string, chatId: string): Promise<Chat> {
    const chat = await this.chats.find(ChatId.of(chatId));

    if (!chat?.isOf(TeamId.of(teamId))) {
      throw new UnknownChatError(chatId);
    }

    return chat;
  }
}
