import type { Chat } from '@work/domain/aggregates/chat.aggregate';

export const CHAT_DISPATCH = Symbol('CHAT_DISPATCH');

export interface ChatDispatching {
  takenUp(chat: Chat): Promise<Chat>;
}
