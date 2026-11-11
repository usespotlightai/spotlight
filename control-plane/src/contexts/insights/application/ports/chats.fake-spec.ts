import type {
  ChatsPort,
  StartedChat,
} from '@insights/application/ports/chats.port';
import { ownedIn } from '@insights/scoped.fake-spec';

export const chatsInMemory = (): ChatsPort & {
  readonly stored: Map<string, StartedChat>;
} => {
  const stored = new Map<string, StartedChat>();

  return {
    stored,
    note: async (chat) => {
      if (!stored.has(chat.chatId)) {
        stored.set(chat.chatId, chat);
      }
    },
    removeIn: async (scope) => {
      for (const [id, each] of stored) {
        if (ownedIn(scope, each)) {
          stored.delete(id);
        }
      }
    },
  };
};
