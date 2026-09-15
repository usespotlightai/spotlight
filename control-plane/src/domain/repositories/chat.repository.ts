import type { Chat } from '@domain/aggregates/chat.aggregate';
import type { ChatId } from '@domain/value-objects/chat-id.vo';

export interface ChatRepository {
  add(chat: Chat): Promise<void>;

  save(chat: Chat): Promise<void>;

  find(id: ChatId): Promise<Chat | null>;
}
