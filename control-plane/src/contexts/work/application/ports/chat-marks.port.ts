import type { ChatId } from '@work/domain/value-objects/chat-id.vo';
import type { Mark } from '@work/domain/value-objects/mark.vo';

export const CHAT_MARKS = Symbol('CHAT_MARKS');

export interface ChatMarksPort {
  ambientOf(chatId: ChatId): Promise<readonly Mark[]>;
}
