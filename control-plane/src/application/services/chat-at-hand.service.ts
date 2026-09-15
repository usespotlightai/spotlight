import type { Chat } from '@domain/aggregates/chat.aggregate';
import { UnknownChatError } from '@domain/exceptions/unknown-chat.error';
import type { ChatRepository } from '@domain/repositories/chat.repository';
import { ChatId } from '@domain/value-objects/chat-id.vo';
import { TeamId } from '@domain/value-objects/team-id.vo';

export class ChatAtHand {
  constructor(private readonly chats: ChatRepository) {}

  async inTeam(teamId: string, chatId: string): Promise<Chat> {
    const chat = await this.chats.find(ChatId.of(chatId));

    if (!chat?.isOf(TeamId.of(teamId))) {
      throw new UnknownChatError(chatId);
    }

    return chat;
  }
}
